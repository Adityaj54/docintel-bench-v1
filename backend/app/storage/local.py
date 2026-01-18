import os
import tempfile
from pathlib import Path

from app.core.errors import DomainError
from app.storage.base import StorageBackend, validate_key


class LocalStorageBackend(StorageBackend):
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)

    def path_for(self, key: str) -> Path:
        candidate = (self.root / validate_key(key)).resolve()
        if not candidate.is_relative_to(self.root):
            raise DomainError("INVALID_STORAGE_KEY", "Storage path is outside the storage root.")
        return candidate

    def put(self, key: str, content: bytes, mime_type: str) -> None:
        destination = self.path_for(key)
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        descriptor, temporary = tempfile.mkstemp(prefix=".upload-", dir=destination.parent)
        try:
            with os.fdopen(descriptor, "wb") as output:
                output.write(content)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, destination)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def get(self, key: str) -> bytes:
        try:
            return self.path_for(key).read_bytes()
        except FileNotFoundError as exc:
            raise DomainError("FILE_MISSING", "The stored document is unavailable.", 404) from exc

    def delete(self, key: str) -> None:
        self.path_for(key).unlink(missing_ok=True)

    def exists(self, key: str) -> bool:
        return self.path_for(key).is_file()

    def access_url(self, key: str, expires: int = 300) -> str | None:
        validate_key(key)
        return None
