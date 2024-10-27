import base64
from fastapi import HTTPException
from langchain_pinecone import PineconeVectorStore
from langchain_core.runnables import RunnableConfig

import json
import os
from langchain.tools.retriever import create_retriever_tool
from langchain.prompts import PromptTemplate
from langchain_openai import OpenAIEmbeddings

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool


DEFAULT_DOCUMENT_PROMPT = PromptTemplate.from_template(
    """
    ###TITLE OF THE PAGE:{title}
    ###PAGE URL:{url}
    ###PAGE CONTENT:
    {page_content}
    """
)

PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX")
vectorstore = PineconeVectorStore.from_existing_index(
    PINECONE_INDEX_NAME, OpenAIEmbeddings(
        model="text-embedding-3-large"
    )
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
