"""Local-disk file storage for listing photos and private residency documents.

Serverless hosts have an ephemeral filesystem, so production deployments need
to swap this for object storage (S3, Vercel Blob, ...) behind the same functions.
"""

import secrets
from pathlib import Path

from app.core.config import get_settings
from app.core.errors import HomieError

_SIGNATURES: dict[str, list[bytes]] = {
    "jpg": [b"\xff\xd8\xff"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "webp": [b"RIFF"],
    "pdf": [b"%PDF-"],
}


def _sniff(data: bytes, allowed: set[str]) -> str:
    for ext in allowed:
        for sig in _SIGNATURES[ext]:
            if data.startswith(sig) and (ext != "webp" or data[8:12] == b"WEBP"):
                return ext
    raise HomieError("Unsupported file type. Allowed: " + ", ".join(sorted(allowed)))


def _root() -> Path:
    return Path(get_settings().upload_root).resolve()


def photos_dir() -> Path:
    path = _root() / "photos"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _save(data: bytes, folder: Path, allowed: set[str]) -> str:
    limit = get_settings().max_upload_mb * 1024 * 1024
    if not data:
        raise HomieError("The file is empty")
    if len(data) > limit:
        raise HomieError(f"File is larger than {get_settings().max_upload_mb} MB")
    ext = _sniff(data, allowed)
    name = f"{secrets.token_urlsafe(16)}.{ext}"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / name).write_bytes(data)
    return name


def save_photo(data: bytes) -> str:
    """Store a listing photo and return its public URL path."""
    return "/api/uploads/photos/" + _save(data, photos_dir(), {"jpg", "png", "webp"})


def save_private_document(data: bytes) -> str:
    """Store a residency document outside the public folder; returns its file name."""
    return _save(data, _root() / "private", {"jpg", "png", "webp", "pdf"})


def private_document_path(name: str) -> Path:
    path = (_root() / "private" / name).resolve()
    if path.parent != (_root() / "private") or not path.is_file():
        raise HomieError("Document not found")
    return path
