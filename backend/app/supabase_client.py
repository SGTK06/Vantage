from supabase import Client, ClientOptions, create_client
from app.config import SUPABASE_URL, SUPABASE_KEY

def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY environment variables must be configured")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_authenticated_supabase_client(access_token: str) -> Client:
    """Create a request-scoped client whose RLS identity is the current user.

    The service key is intentionally not used here. The JWT is sent to both
    PostgREST and Storage, so Supabase evaluates the existing RLS policies as
    the authenticated user for every operation in the request.
    """
    if not access_token:
        raise ValueError("An access token is required")
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY environment variables must be configured")

    return create_client(
        SUPABASE_URL,
        SUPABASE_KEY,
        ClientOptions(headers={"Authorization": f"Bearer {access_token}"}),
    )
