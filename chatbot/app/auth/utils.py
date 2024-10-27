from typing import Any, Dict
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
security = HTTPBearer()

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
