from fastapi import Depends, FastAPI
from fastapi.responses import RedirectResponse
from langserve import add_routes
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())
from fastapi.middleware.cors import CORSMiddleware
from app.auth.utils import validate_token, fetch_api_key_from_header
from app.graph.agent import agent_runnable
from app.tools.ingestion import ingest_runnable

app = FastAPI()

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)



@app.get("/")
async def redirect_root_to_docs():
    return RedirectResponse("/docs")


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
