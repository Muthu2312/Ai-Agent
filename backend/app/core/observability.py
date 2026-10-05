import os
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def setup_langsmith() -> None:
    """Configures LangSmith environment variables and checks tracing readiness."""
    if settings.LANGCHAIN_TRACING_V2 and settings.LANGCHAIN_API_KEY:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGCHAIN_ENDPOINT
        os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
        os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT
        logger.info(f"LangSmith observability active for project: '{settings.LANGCHAIN_PROJECT}'")
    else:
        # Graceful fallback when API key is not yet set
        os.environ["LANGCHAIN_TRACING_V2"] = "false"
        logger.info("LangSmith tracing is disabled (LANGCHAIN_API_KEY not configured in .env).")


# Cache project URL once fetched
_cached_project_url = None


def get_langsmith_status() -> dict:
    """Returns observability connectivity, direct project dashboard URL, and config status."""
    global _cached_project_url

    is_active = (
        os.environ.get("LANGCHAIN_TRACING_V2") == "true"
        and bool(settings.LANGCHAIN_API_KEY)
    )

    if not _cached_project_url and settings.LANGCHAIN_API_KEY:
        try:
            from langsmith import Client
            client = Client(api_key=settings.LANGCHAIN_API_KEY)
            if client.has_project(settings.LANGCHAIN_PROJECT):
                p = client.read_project(project_name=settings.LANGCHAIN_PROJECT)
                _cached_project_url = getattr(p, "url", None)
        except Exception as e:
            logger.debug(f"Could not fetch LangSmith project URL: {e}")

    # Fallback to projects listing if specific URL not available
    resolved_url = _cached_project_url or f"https://smith.langchain.com/projects"

    return {
        "tracing_enabled": is_active,
        "project": settings.LANGCHAIN_PROJECT,
        "endpoint": settings.LANGCHAIN_ENDPOINT,
        "has_api_key": bool(settings.LANGCHAIN_API_KEY),
        "dashboard_url": resolved_url,
    }
