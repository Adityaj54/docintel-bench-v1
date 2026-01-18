from app.core.config import get_settings
from app.core.errors import DomainError
from app.storage.base import StorageBackend
from app.storage.local import LocalStorageBackend
from app.storage.s3 import S3StorageBackend


def get_storage() -> StorageBackend:
    settings = get_settings()
    if settings.storage_backend == "local":
        return LocalStorageBackend(settings.storage_root)
    if settings.storage_backend == "s3":
        return S3StorageBackend(settings.s3_bucket, settings.s3_endpoint_url, settings.s3_region)
    raise DomainError("STORAGE_CONFIGURATION", "Unsupported storage backend.", 503)
