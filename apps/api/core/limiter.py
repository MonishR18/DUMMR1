import logging
import redis
from slowapi import Limiter
from slowapi.util import get_remote_address
from core.config import settings

logger = logging.getLogger(__name__)

def get_limiter_storage_uri() -> str:
    try:
        r = redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1)
        r.ping()
        return settings.REDIS_URL
    except Exception as e:
        logger.info(f"Redis not available for rate limiting ({e}), using in-memory limiter storage")
        return "memory://"

limiter = Limiter(key_func=get_remote_address, storage_uri=get_limiter_storage_uri())
