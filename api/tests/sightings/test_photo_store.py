import json
from collections.abc import Callable

import httpx
import pytest

from app.sightings.photo_store import PhotoStore, StorageUnavailable, thumb_path


def make_store(handler: Callable[[httpx.Request], httpx.Response]) -> PhotoStore:
    return PhotoStore("http://supabase.test", "secret", transport=httpx.MockTransport(handler))


def test_upload_puts_jpeg_into_private_bucket_with_upsert():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"Key": "photos/p/s.jpg"})

    make_store(handler).upload("p/s.jpg", b"\xff\xd8jpeg")

    (request,) = requests
    assert request.method == "POST"
    assert str(request.url) == "http://supabase.test/storage/v1/object/photos/p/s.jpg"
    assert request.headers["authorization"] == "Bearer secret"
    assert request.headers["apikey"] == "secret"
    assert request.headers["content-type"] == "image/jpeg"
    assert request.headers["x-upsert"] == "true"
    assert request.content == b"\xff\xd8jpeg"


def test_signed_url_returns_absolute_url():
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "http://supabase.test/storage/v1/object/sign/photos/p/s.jpg"
        assert request.headers["authorization"] == "Bearer secret"
        assert request.headers["apikey"] == "secret"
        assert json.loads(request.content) == {"expiresIn": 3600}
        return httpx.Response(200, json={"signedURL": "/object/sign/photos/p/s.jpg?token=t"})

    url = make_store(handler).signed_url("p/s.jpg", 3600)

    assert url == "http://supabase.test/storage/v1/object/sign/photos/p/s.jpg?token=t"


@pytest.mark.parametrize("status", [400, 404, 500])
def test_error_status_raises_unavailable(status: int):
    with pytest.raises(StorageUnavailable):
        make_store(lambda _r: httpx.Response(status)).signed_url("p/s.jpg", 60)


def test_network_error_raises_unavailable():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    with pytest.raises(StorageUnavailable):
        make_store(handler).signed_url("p/s.jpg", 60)


def test_upload_error_raises_unavailable():
    with pytest.raises(StorageUnavailable):
        make_store(lambda _r: httpx.Response(500)).upload("p/s.jpg", b"x")


def test_download_returns_the_photo_bytes():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert str(request.url) == "http://supabase.test/storage/v1/object/photos/p/s.jpg"
        assert request.headers["authorization"] == "Bearer secret"
        return httpx.Response(200, content=b"\xff\xd8jpeg")

    assert make_store(handler).download("p/s.jpg") == b"\xff\xd8jpeg"


def test_download_error_raises_unavailable():
    with pytest.raises(StorageUnavailable):
        make_store(lambda _r: httpx.Response(404)).download("p/s.jpg")


def test_thumb_path_sits_next_to_the_photo():
    assert thumb_path("p1/abc.jpg") == "p1/abc.thumb.jpg"
