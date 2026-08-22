import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# We make this a function or lazy loaded so it doesn't fail immediately in tests if env vars are missing
def get_supabase() -> Client:
    url: str = os.environ.get("SUPABASE_URL", "mock-url")
    key: str = os.environ.get("SUPABASE_KEY", "mock-key")
    return create_client(url, key)
