import logging
import time
from typing import Optional, Any
import redis
from core.config import settings

logger = logging.getLogger(__name__)

class InMemoryCache:
    """Thread-safe fallback in-memory cache when Redis is unavailable or for testing."""
    def __init__(self):
        self._store: dict[str, tuple[Any, Optional[float]]] = {}

    def _is_expired(self, key: str) -> bool:
        if key not in self._store:
            return True
        val, expiry = self._store[key]
        if expiry is not None and time.time() > expiry:
            del self._store[key]
            return True
        return False

    def get(self, key: str) -> Optional[str]:
        if self._is_expired(key):
            return None
        return str(self._store[key][0])

    def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        expiry = time.time() + ex if ex is not None else None
        self._store[key] = (value, expiry)
        return True

    def setex(self, key: str, time_seconds: int, value: Any) -> bool:
        return self.set(key, value, ex=time_seconds)

    def delete(self, *keys: str) -> int:
        count = 0
        for k in keys:
            if k in self._store:
                del self._store[k]
                count += 1
        return count

    def exists(self, key: str) -> int:
        return 0 if self._is_expired(key) else 1

_in_memory_fallback = InMemoryCache()
_redis_client: Optional[redis.Redis] = None

def get_redis_client():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=1)
        client.ping()
        _redis_client = client
        return _redis_client
    except Exception as e:
        logger.warning(f"Could not connect to Redis at {settings.REDIS_URL}: {e}. Falling back to in-memory cache.")
        return _in_memory_fallback

def block_token(jti: str, ttl_seconds: int) -> None:
    if ttl_seconds <= 0:
        ttl_seconds = 60
    client = get_redis_client()
    try:
        client.setex(f"bl_{jti}", int(ttl_seconds), "1")
    except Exception as e:
        logger.warning(f"Redis block_token error: {e}. Using in-memory fallback.")
        _in_memory_fallback.setex(f"bl_{jti}", int(ttl_seconds), "1")

def is_token_blocked(jti: str) -> bool:
    client = get_redis_client()
    try:
        return bool(client.exists(f"bl_{jti}"))
    except Exception as e:
        logger.warning(f"Redis is_token_blocked error: {e}. Using in-memory fallback.")
        return bool(_in_memory_fallback.exists(f"bl_{jti}"))

def check_and_record_view(service_id: int, viewer_key: str, ttl_seconds: int = 86400) -> bool:
    """Returns True if this viewer has NOT viewed the service within ttl_seconds, and records the view."""
    key = f"view_{service_id}_{viewer_key}"
    client = get_redis_client()
    try:
        if client.exists(key):
            return False
        client.setex(key, ttl_seconds, "1")
        return True
    except Exception as e:
        logger.warning(f"Redis check_and_record_view error: {e}. Using in-memory fallback.")
        if _in_memory_fallback.exists(key):
            return False
        _in_memory_fallback.setex(key, ttl_seconds, "1")
        return True
