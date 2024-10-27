from typing import AsyncIterator
from langchain_core.runnables import RunnableLambda
from langgraph.graph import StateGraph, START, MessagesState
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage
from app.tools.tools import retriever_tool, gmail_get_tool

llm = ChatOpenAI(model="gpt-4o-mini")
graph_builder = StateGraph(MessagesState)

tools = [retriever_tool, gmail_get_tool]
llm_with_tools = llm.bind_tools(tools)

template = """
You are Claudiu, an AI assistant that can help you with your questions.
You can answer questions about the company's internal knowledge base, or about your emails.
You will not be able to answer questions outside of these topics.
You will always respond in Romanian.
"""


def get_messages_info(messages):
    return [SystemMessage(content=template)] + messages

def chatbot(state: MessagesState):
    return {"messages": [llm_with_tools.invoke(get_messages_info(state["messages"]))]}

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
