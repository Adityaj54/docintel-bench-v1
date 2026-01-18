from abc import ABC, abstractmethod
from pathlib import PurePosixPath

from app.core.errors import DomainError


def validate_key(key: str) -> str:
    path = PurePosixPath(key)
    if (
        not key
        or len(key) > 500
        or path.is_absolute()
        or ".." in path.parts
        or "\\" in key
        or "\x00" in key
        or str(path) != key
    ):
        raise DomainError("INVALID_STORAGE_KEY", "Storage key is invalid.")
    return key


class StorageBackend(ABC):
    @abstractmethod
    def put(self, key: str, content: bytes, mime_type: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def get(self, key: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    def delete(self, key: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def exists(self, key: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def access_url(self, key: str, expires: int = 300) -> str | None:
        raise NotImplementedError
