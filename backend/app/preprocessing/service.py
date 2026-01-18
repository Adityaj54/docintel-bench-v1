import io
from typing import Any

import fitz
from PIL import Image, ImageOps

from app.core.config import get_settings
from app.core.errors import DomainError
from app.models import Document
from app.storage.base import StorageBackend


def image_bytes(image: Image.Image) -> tuple[bytes, int, int]:
    limit = get_settings().max_image_dimension
    image = ImageOps.exif_transpose(image)
    if image.mode in {"RGBA", "LA", "P"}:
        rgba = image.convert("RGBA")
        background = Image.new("RGBA", rgba.size, "white")
        image = Image.alpha_composite(background, rgba).convert("RGB")
    else:
        image = image.convert("RGB")
    image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue(), image.width, image.height


def preprocess(document: Document, storage: StorageBackend) -> list[dict[str, Any]]:
    content = storage.get(document.storage_key)
    settings = get_settings()
    artifacts: list[dict[str, Any]] = []

    def save_page(image: Image.Image, index: int, text: str = "") -> None:
        rendered, width, height = image_bytes(image)
        key = f"artifacts/{document.id}/page-{index + 1}.png"
        storage.put(key, rendered, "image/png")
        artifacts.append({
            "page": index + 1,
            "storage_key": key,
            "width": width,
            "height": height,
            "mime_type": "image/png",
            "text": text[:50000],
        })

    try:
        if document.mime_type == "application/pdf":
            with fitz.open(stream=content, filetype="pdf") as pdf:
                if len(pdf) > settings.max_pdf_pages or pdf.is_encrypted:
                    raise DomainError("PDF_PAGE_LIMIT", "PDF is encrypted or exceeds page limits.")
                for index, page in enumerate(pdf):
                    scale = min(
                        settings.render_dpi / 72,
                        settings.max_image_dimension / max(page.rect.width, page.rect.height),
                    )
                    pixels = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
                    with Image.open(io.BytesIO(pixels.tobytes("png"))) as image:
                        save_page(image, index, page.get_text())
        else:
            with Image.open(io.BytesIO(content)) as image:
                save_page(image, 0)
    except DomainError:
        raise
    except (OSError, RuntimeError, ValueError) as exc:
        raise DomainError("PREPROCESSING_FAILED", "The document could not be rendered.") from exc
    return artifacts
