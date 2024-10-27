import base64
from typing import Any, AsyncIterator, Dict
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langserve import add_routes
from langchain_core.runnables import RunnableLambda, RunnableConfig

from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv, find_dotenv
import json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io
import os
from langchain.tools.retriever import create_retriever_tool
from langchain.prompts import PromptTemplate
from langchain_openai import OpenAIEmbeddings
from PyPDF2 import PdfReader

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
security = HTTPBearer()
app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


load_dotenv(find_dotenv())

PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX")
vectorstore = PineconeVectorStore.from_existing_index(
    PINECONE_INDEX_NAME, OpenAIEmbeddings(
        model="text-embedding-3-large"
    )
)

class GoogleDriveHandler:
    SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

    def __init__(self, credentials_path=".credentials/credentials.json"):
        self.credentials_path = credentials_path
        self.creds = self.authenticate()
        self.service = build('drive', 'v3', credentials=self.creds)

    def authenticate(self):
        with open(self.credentials_path, 'r') as file:
            creds_dict = json.load(file)
        creds = Credentials.from_service_account_info(creds_dict, scopes=self.SCOPES)
        return creds

    def list_files(self, page_size=10):
        results = self.service.files().list(pageSize=page_size, fields="nextPageToken, files(id, name, mimeType)").execute()
        items = results.get('files', [])
        items = [item for item in items if item['mimeType'] != 'application/vnd.google-apps.folder']
        if not items:
            print('No files found.')
            return []
        else:
            print('Files:')
            for item in items:
                print(f"{item['name']} ({item['id']}) - {item['mimeType']}")
        return items

    def extract_text(self, file_id, file_name, mime_type):
        export_mime_types = {
            'application/vnd.google-apps.document': 'text/plain',
            'application/vnd.google-apps.spreadsheet': 'text/csv',
            'application/vnd.google-apps.presentation': 'text/plain'
        }
        print(f"Starting text extraction for file: {file_name} ({file_id}) with MIME type: {mime_type}")

        try: 
            if mime_type.startswith('application/vnd.google-apps.'):
                if mime_type in export_mime_types:
                    export_mime_type = export_mime_types[mime_type]
                    request = self.service.files().export_media(fileId=file_id, mimeType=export_mime_type)
                else:
                    print(f'Skipping unsupported Google Apps file type: {file_name} ({mime_type})')
                    return None
            else:
                request = self.service.files().get_media(fileId=file_id)

            file_stream = io.BytesIO()
            downloader = MediaIoBaseDownload(file_stream, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            file_stream.seek(0)
            
            # Handle PDF files
            if mime_type == 'application/pdf':
                try:
                    pdf_reader = PdfReader(file_stream)
                    text_content = ""
                    for page in pdf_reader.pages:
                        text_content += page.extract_text() + "\n"
                    print(f"Successfully extracted text from PDF {file_name} with {len(text_content)} characters")
                    return text_content
                except Exception as e:
                    print(f'Error processing PDF {file_name}: {str(e)}')
                    return None
            
            # Handle other text files
            encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
            text_content = None
            
            for encoding in encodings:
                try:
                    
                    text_content = file_stream.read().decode(encoding)
                    file_stream.seek(0)  # Reset position for next attempt if needed
                    break
                except UnicodeDecodeError:
                    continue
            
            if text_content is None:
                print(f'Could not decode {file_name} with any supported encoding')
                return None
                
            print(f'Successfully extracted text from {file_name}')
            return text_content
            
        except Exception as e:
            print(f'Error processing {file_name}: {str(e)}')
            return None

    def call(self):
        # List files - call list_files with self instead of service
        files = self.list_files()

        texts = []
        # Read files
        for file in files:
            text = self.extract_text(file['id'], file['name'], file['mimeType'])
            print(f"Extracted text from {file['name']}: {text}")
            if text:
                texts.append(text)
        print(f"Extracted {len(texts)} texts from {len(files)} files")
        metadatas = []
        for file in files:
            metadatas.append({
            'title': file['name'],
            'url': f"https://drive.google.com/file/d/{file['id']}/view",
            })
        return texts, metadatas
        
DEFAULT_DOCUMENT_PROMPT = PromptTemplate.from_template(
    """
    ###TITLE OF THE PAGE:{title}
    ###PAGE URL:{url}
    ###PAGE CONTENT:
    {page_content}
    """
)

retriever_tool = create_retriever_tool(
    vectorstore.as_retriever(search_kwargs={"k": 3}),
    name="internal_knowledge_base_retriever",
    document_prompt=DEFAULT_DOCUMENT_PROMPT,
    document_separator="\n\n",
    description=f"""
    Retrieve documents from the internal company knowledge base.
    The search query should take into consideration the previous messages in the chat history

    """,
)


@tool
async def gmail_get_tool(per_page: int, special_config_param: RunnableConfig) -> str:
    """Get emails from gmail per page"""
    import httpx

    async with httpx.AsyncClient() as client:
        headers = {
            "Authorization": f"Bearer {special_config_param['configurable']['token']}",
            "Accept": "application/json"
        }
        response = await client.get(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages",
            headers=headers,
            params={"maxResults": per_page}
        )

        if response.status_code == 200:
            messages = response.json().get("messages", [])
            full_messages = []
            for message in messages:
                message_id = message.get("id")
                if message_id:
                    message_response = await client.get(
                        f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}?format=full",
                        headers=headers
                    )
                    if message_response.status_code == 200:
                        message_data = message_response.json()
                        if "payload" in message_data and "parts" in message_data["payload"]:
                            for part in message_data["payload"]["parts"]:
                                if "body" in part and "data" in part["body"]:
                                    encoded_data = part["body"]["data"]
                                    # Replace URL-safe characters and add padding
                                    encoded_data = encoded_data.replace('-', '+').replace('_', '/')
                                    padding = 4 - (len(encoded_data) % 4)
                                    if padding != 4:
                                        encoded_data += '=' * padding
                                    try:
                                        decoded_data = base64.b64decode(encoded_data).decode('utf-8')
                                        part["body"]["data"] = decoded_data
                                    except Exception as e:
                                        print(f"Error decoding message part: {str(e)}")
                                        continue
                        full_messages.append(message_data)
                    else:
                        raise HTTPException(
                            status_code=message_response.status_code,
                            detail=f"Failed to fetch full message: {message_response.text}"
                        )
            return json.dumps(full_messages)
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to fetch emails: {response.text}"
            )

llm = ChatOpenAI(model="gpt-4o-mini")
graph_builder = StateGraph(MessagesState)

tools = [retriever_tool, gmail_get_tool]
llm_with_tools = llm.bind_tools(tools)

def chatbot(state: MessagesState):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}

graph_builder.add_node("chatbot", chatbot)

tool_node = ToolNode(tools=tools)
graph_builder.add_node("tools", tool_node)

graph_builder.add_conditional_edges(
    "chatbot",
    tools_condition,
)

graph_builder.add_edge("tools", "chatbot")
graph_builder.add_edge(START, "chatbot")

graph = graph_builder.compile()    

@app.get("/")
async def redirect_root_to_docs():
    return RedirectResponse("/docs")


async def get_token_from_request(request: Request):
    """Get the current active user from the request."""
    token = await oauth2_scheme(request)
    return token
    

async def fetch_api_key_from_header(config: Dict[str, Any], req: Request) -> Dict[str, Any]:
    token = await get_token_from_request(req)
    if token:
        config["configurable"] = {}
        config["configurable"]["token"] = token
    
    return config

def validate_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        return True
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
        )

def get_split_documents(texts, metadatas):
    text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        model_name="gpt-4",
        chunk_size=800,
        chunk_overlap=200,
    )
    documents = text_splitter.create_documents(texts=texts, metadatas=metadatas)
    return documents

async def ingest(input, config: RunnableConfig):
    gdrive = GoogleDriveHandler()
    texts, metadatas = gdrive.call()

    vectorstore.add_documents(get_split_documents(texts, metadatas))
    
    return True

ingest_runnable = RunnableLambda(ingest)


async def custom_stream(input, config) -> AsyncIterator[str]:
    agent_executor = graph
    async for event in agent_executor.astream_events(input={
        "messages": input["messages"],
        },
        config=config,
        version="v1",
    ):
        kind = event["event"]
        if kind == "on_chat_model_stream":
            content = event["data"]["chunk"].content
            if content:
                yield content
        
agent_runnable = RunnableLambda(custom_stream)

add_routes(app, 
           agent_runnable,
           path="/chat",
           dependencies=[Depends(validate_token)],
           per_req_config_modifier=fetch_api_key_from_header,
           config_keys=["configurable"])

add_routes(app,
           ingest_runnable,
           path="/ingest",
           config_keys=["configurable"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
