import boto3
from botocore.exceptions import ClientError

from app.core.errors import DomainError, TransientError
from app.storage.base import StorageBackend, validate_key


class S3StorageBackend(StorageBackend):
    def __init__(self, bucket: str, endpoint_url: str = "", region: str = "us-east-1"):
        if not bucket:
            raise DomainError("STORAGE_CONFIGURATION", "S3 storage requires S3_BUCKET.", 503)
        self.bucket = bucket
        self.client = boto3.client("s3", endpoint_url=endpoint_url or None, region_name=region)

    def put(self, key: str, content: bytes, mime_type: str) -> None:
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=validate_key(key),
                Body=content,
                ContentType=mime_type,
            )
        except ClientError as exc:
            raise TransientError("Could not write to object storage.", "STORAGE_UNAVAILABLE") from exc

    def get(self, key: str) -> bytes:
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=validate_key(key))
            with response["Body"] as body:
                return body.read()
        except ClientError as exc:
            if exc.response["Error"]["Code"] in {"NoSuchKey", "404", "NotFound"}:
                raise DomainError("FILE_MISSING", "The stored document is unavailable.", 404) from exc
            raise TransientError("Object storage is unavailable.", "STORAGE_UNAVAILABLE") from exc

    def delete(self, key: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=validate_key(key))
        except ClientError as exc:
            raise TransientError("Could not remove the stored object.", "STORAGE_UNAVAILABLE") from exc

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=validate_key(key))
            return True
        except ClientError as exc:
            if exc.response["Error"]["Code"] in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise TransientError("Object storage is unavailable.", "STORAGE_UNAVAILABLE") from exc

    def access_url(self, key: str, expires: int = 300) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": validate_key(key)},
            ExpiresIn=min(max(expires, 30), 900),
        )
