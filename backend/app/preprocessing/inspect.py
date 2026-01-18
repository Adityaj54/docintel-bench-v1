import hashlib
import io
import warnings
from dataclasses import dataclass
from pathlib import PurePath

import fitz
from PIL import Image, UnidentifiedImageError

from app.core.config import get_settings
from app.core.errors import DomainError

EXTENSIONS = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}
IMAGE_FORMATS = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}


@dataclass(frozen=True)
class InspectedFile:
    filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    page_count: int
    width: int | None
    height: int | None


def safe_filename(filename: str) -> str:
    name = PurePath(filename.replace("\\", "/")).name
    name = "".join(character for character in name if ord(character) >= 32 and ord(character) != 127)
    if not name or len(name) > 255:
        raise DomainError("INVALID_FILENAME", "Choose a filename between 1 and 255 characters.")
    return name


def inspect_file(filename: str, declared_mime: str, content: bytes) -> InspectedFile:
    settings = get_settings()
    name = safe_filename(filename)
    suffix = PurePath(name).suffix.lower()
    expected_mime = EXTENSIONS.get(suffix)
    if not expected_mime:
        raise DomainError("UNSUPPORTED_FILE", "Upload a PDF, PNG, JPEG, or WebP document.", 415)
    if not content:
        raise DomainError("EMPTY_FILE", "The uploaded file is empty.")
    if len(content) > settings.max_upload_bytes:
        raise DomainError("FILE_TOO_LARGE", "The document exceeds the upload size limit.", 413)
    declared_mime = declared_mime.partition(";")[0].strip().lower()
    if declared_mime != expected_mime:
        raise DomainError("MIME_MISMATCH", "The filename and declared MIME type do not match.", 415)
    width = height = None
    pages = 1
    if expected_mime == "application/pdf":
        if not content.startswith(b"%PDF-"):
            raise DomainError("INVALID_PDF", "File content is not a PDF.")
        try:
            with fitz.open(stream=content, filetype="pdf") as pdf:
                if pdf.is_encrypted:
                    raise DomainError("ENCRYPTED_PDF", "Password-protected PDFs are not supported.")
                pages = len(pdf)
                if pages < 1 or pages > settings.max_pdf_pages:
                    raise DomainError(
                        "PDF_PAGE_LIMIT",
                        f"PDFs must contain 1 to {settings.max_pdf_pages} pages.",
                    )
        except (fitz.FileDataError, RuntimeError) as exc:
            raise DomainError("INVALID_PDF", "The PDF could not be read.") from exc
    else:
        Image.MAX_IMAGE_PIXELS = settings.max_image_pixels
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(content)) as image:
                    width, height = image.size
                    if IMAGE_FORMATS.get(image.format) != expected_mime:
                        raise DomainError("MIME_MISMATCH", "Image content does not match its type.", 415)
                    if width * height > settings.max_image_pixels:
                        raise DomainError("IMAGE_TOO_LARGE", "Image pixel count exceeds the limit.")
                    if getattr(image, "n_frames", 1) != 1:
                        raise DomainError("ANIMATED_IMAGE", "Upload a still image.")
                    image.verify()
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError,
                Image.DecompressionBombWarning) as exc:
            raise DomainError("INVALID_IMAGE", "The image is invalid or exceeds pixel limits.") from exc
    return InspectedFile(
        filename=name,
        mime_type=expected_mime,
        size_bytes=len(content),
        sha256=hashlib.sha256(content).hexdigest(),
        page_count=pages,
        width=width,
        height=height,
    )
