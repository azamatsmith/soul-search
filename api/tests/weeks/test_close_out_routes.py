from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.clock import get_now
from app.main import create_app
from app.weeks.repo import get_weeks_repo
from tests.conftest import T0
from tests.fakes import FakeWeeksRepo


@pytest.fixture
def repo() -> FakeWeeksRepo:
    return FakeWeeksRepo(current_week_id=uuid4())


@pytest.fixture
def client(repo: FakeWeeksRepo) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_weeks_repo] = lambda: repo
    app.dependency_overrides[get_now] = lambda: T0
    return TestClient(app)


def test_closes_weeks_with_the_secret(client: TestClient, repo: FakeWeeksRepo):
    closed = uuid4()
    repo.ended = [closed]

    response = client.post("/close-out", headers={"X-Close-Out-Secret": "test-close-out-secret"})

    assert response.status_code == 200
    assert response.json() == {
        "closed": [str(closed)],
        "current_week_id": str(repo.current_week_id),
    }
    assert repo.calls == [T0]


@pytest.mark.parametrize("headers", [{}, {"X-Close-Out-Secret": "wrong"}])
def test_rejects_a_missing_or_wrong_secret(
    client: TestClient, repo: FakeWeeksRepo, headers: dict[str, str]
):
    response = client.post("/close-out", headers=headers)

    assert response.status_code == 401
    assert response.json() == {"error": "invalid_secret"}
    assert repo.calls == []
