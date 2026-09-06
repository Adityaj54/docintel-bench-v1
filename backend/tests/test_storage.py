import pytest

from app.core.errors import DomainError
from app.storage.base import validate_key
from app.storage.local import LocalStorageBackend


@pytest.fixture
def storage(tmp_path):
    return LocalStorageBackend(tmp_path)


def test_content_round_trips(storage):
    storage.put("documents/project/original", b"binary content", "application/pdf")
    assert storage.get("documents/project/original") == b"binary content"


def test_exists_reflects_what_was_written(storage):
    assert storage.exists("documents/a") is False
    storage.put("documents/a", b"x", "image/png")
    assert storage.exists("documents/a") is True


def test_delete_removes_the_object(storage):
    storage.put("documents/b", b"x", "image/png")
    storage.delete("documents/b")
    assert storage.exists("documents/b") is False


def test_deleting_something_absent_is_not_an_error(storage):
    storage.delete("documents/never-written")


def test_reading_something_absent_raises_a_domain_error(storage):
    with pytest.raises(DomainError) as failure:
        storage.get("documents/never-written")
    assert failure.value.code == "FILE_MISSING"


def test_writing_the_same_key_replaces_the_content(storage):
    storage.put("documents/c", b"first", "image/png")
    storage.put("documents/c", b"second", "image/png")
    assert storage.get("documents/c") == b"second"


def test_nested_keys_create_their_directories(storage, tmp_path):
    storage.put("a/b/c/d", b"deep", "image/png")
    assert (tmp_path / "a" / "b" / "c" / "d").exists()


def test_the_local_backend_has_no_presigned_url(storage):
    storage.put("documents/d", b"x", "image/png")
    assert storage.access_url("documents/d") is None


@pytest.mark.parametrize("key", [
    "documents/valid/original",
    "a",
    "a-b_c.d~e:f@g+h/i",
])
def test_acceptable_keys_are_returned_unchanged(key):
    assert validate_key(key) == key


@pytest.mark.parametrize("key", [
    "",
    "/absolute/path",
    "../escape",
    "documents/../../etc/passwd",
    "documents/..",
    "windows\\separator",
    "with\x00null",
    "trailing/slash/",
    "double//slash",
    "x" * 501,
])
def test_dangerous_keys_are_refused(key):
    with pytest.raises(DomainError) as failure:
        validate_key(key)
    assert failure.value.code == "INVALID_STORAGE_KEY"


def test_a_traversing_key_cannot_reach_outside_the_root(storage, tmp_path):
    outside = tmp_path.parent / "escaped.txt"
    with pytest.raises(DomainError):
        storage.put("../escaped.txt", b"owned", "text/plain")
    assert not outside.exists()


def test_reading_a_traversing_key_is_refused(storage):
    with pytest.raises(DomainError):
        storage.get("../../etc/passwd")
