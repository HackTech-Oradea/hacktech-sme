from typing import Any, Dict
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer
from langchain_pinecone import PineconeVectorStore
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

from langchain_openai import OpenAIEmbeddings

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
        creds = Credentials.to(creds_dict, scopes=self.SCOPES)
        return creds

    def list_files(self, page_size=10):
        results = self.service.files().list(pageSize=page_size, fields="nextPageToken, files(id, name, mimeType)").execute()
        items = results.get('files', [])
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

        if mime_type.startswith('application/vnd.google-apps.'):
            if mime_type in export_mime_types:
                export_mime_type = export_mime_types[mime_type]
                request = self.service.files().export_media(fileId=file_id, mimeType=export_mime_type)
            else:
                print(f'Skipping unsupported Google Apps file type: {file_name} ({mime_type})')
                return
        else:
            request = self.service.files().get_media(fileId=file_id)

        file_stream = io.BytesIO()
        downloader = MediaIoBaseDownload(file_stream, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
        file_stream.seek(0)
        text_content = file_stream.read().decode('utf-8')
        print(f'Text content of {file_name}:\n{text_content}\n')
    
    def call(self):
        creds = self.authenticate()
        service = build('drive', 'v3', credentials=creds)

        # List files
        files = self.list_files(service)

        texts = []
        # Read files
        for file in files:
            texts.append(self.extract_text(file['id'], file['name'], file['mimeType']))
        
        metadatas = []
        for file in files:
            metadatas.append({
            'title': file['name'],
            'url': f"https://drive.google.com/file/d/{file['id']}/view",
            })
        return texts, metadatas
        


llm = ChatOpenAI(model="gpt-4o-mini")
graph_builder = StateGraph(MessagesState)

# tools = [tool]
# llm_with_tools = llm.bind_tools(tools)

def chatbot(state: MessagesState):
    return {"messages": [llm.invoke(state["messages"])]}

graph_builder.add_node("chatbot", chatbot)

# tool_node = ToolNode(tools=[tool])
# graph_builder.add_node("tools", tool_node)

# graph_builder.add_conditional_edges(
#     "chatbot",
#     tools_condition,
# )

# graph_builder.add_edge("tools", "chatbot")
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

import aiohttp

async def ingest(input, config: RunnableConfig):
    token = config["configurable"]["token"]

    async with aiohttp.ClientSession() as session:
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        async with session.get("https://www.googleapis.com/drive/v3/files", headers=headers) as response:
            if response.status == 200:
                files = await response.json()
                file_contents = []
                for file in files.get('files', []):
                    file_id = file.get('id')
                    if file_id:
                        async with session.get(f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media", headers=headers) as file_response:
                            if file_response.status == 200:
                                content = await file_response.text()
                                file_contents.append({
                                    "id": file_id,
                                    "name": file.get('name'),
                                    "content": content
                                })
                            else:
                                raise HTTPException(
                                    status_code=file_response.status,
                                    detail=f"Failed to fetch content for file ID {file_id}"
                                )
                return file_contents
            else:
                raise HTTPException(
                    status_code=response.status,
                    detail="Failed to fetch files from Google Drive"
                )
    return token

ingest_runnable = RunnableLambda(ingest)

add_routes(app, 
           graph,
           path="/chat",
           dependencies=[Depends(validate_token)],
           per_req_config_modifier=fetch_api_key_from_header,
           disabled_endpoints=["playground"],
           config_keys=["configurable"])

add_routes(app,
           ingest_runnable,
           path="/ingest",
           dependencies=[Depends(validate_token)],
           per_req_config_modifier=fetch_api_key_from_header,
           disabled_endpoints=["playground"],
           config_keys=["configurable"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
