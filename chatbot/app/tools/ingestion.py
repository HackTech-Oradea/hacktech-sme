from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.runnables import RunnableLambda, RunnableConfig
from langchain_core.runnables import RunnableConfig
from app.drives.google_drive import GoogleDriveHandler
from app.tools.tools import vectorstore


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

