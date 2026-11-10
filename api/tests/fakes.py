from dataclasses import replace
from datetime import datetime
from uuid import UUID

from app.auth.lockout import AttemptState
from app.auth.supabase_auth import AuthSession
from app.me.players_repo import NameTaken, Player
from app.sightings.repo import Leaderboard, NewSighting, Period, Sighting, Standing
from app.verification.outcome import CheckResult, Claim, Outcome
from app.verification.repo import PendingSighting


class FakeAttemptsRepo:
    def __init__(self, allowed: set[str]) -> None:
        self.allowed = allowed
        self.states: dict[str, AttemptState] = {}

    def is_allowed(self, email: str) -> bool:
        return email in self.allowed

    def load_for_update(self, email: str) -> AttemptState:
        return self.states.setdefault(email, AttemptState())

    def save(self, email: str, state: AttemptState, now: datetime) -> None:
        self.states[email] = state


class FakeSupabaseAuth:
    def __init__(self) -> None:
        self.sent: list[str] = []
        self.verified: list[tuple[str, str]] = []
        self.next_send: Exception | None = None
        self.next_verify: AuthSession | None | Exception = None

    def send_code(self, email: str) -> None:
        if self.next_send is not None:
            raise self.next_send
        self.sent.append(email)

    def verify_code(self, email: str, code: str) -> AuthSession | None:
        self.verified.append((email, code))
        if isinstance(self.next_verify, Exception):
            raise self.next_verify
        return self.next_verify


class FakePlayersRepo:
    def __init__(self, players: list[Player] | None = None, flagged: int = 0) -> None:
        self.players = {player.id: player for player in players or []}
        self.flagged = flagged

    def get(self, player_id: UUID) -> Player | None:
        return self.players.get(player_id)

    def save_display_name(self, player_id: UUID, name: str) -> Player:
        taken = any(
            p.display_name.lower() == name.lower() and p.id != player_id
            for p in self.players.values()
        )
        if taken:
            raise NameTaken
        existing = self.players.get(player_id)
        player = (
            replace(existing, display_name=name)
            if existing
            else Player(id=player_id, display_name=name, is_admin=False, text_size="standard")
        )
        self.players[player_id] = player
        return player

    def save_text_size(self, player_id: UUID, size: str) -> Player | None:
        existing = self.players.get(player_id)
        if existing is None:
            return None
        player = replace(existing, text_size=size)
        self.players[player_id] = player
        return player

    def flagged_count(self) -> int:
        return self.flagged


EMPTY_STANDING = Standing(
    points=0,
    count=0,
    rank=None,
    total_players=3,
    next_rank=None,
    points_behind_next=None,
    last_photo_path=None,
)


class FakeSightingsRepo:
    def __init__(self, period: Period, closed_fallback: Period | None = None) -> None:
        self.period = period
        self.closed_fallback = closed_fallback
        self.standings: dict[UUID, Standing] = {}
        self.sightings: dict[UUID, Sighting] = {}
        self.inserted: list[NewSighting] = []
        self.period_requests: list[datetime] = []
        self.week: Period | None = None
        self.leaderboards: dict[UUID | None, Leaderboard] = {}

    def period_at(self, at: datetime) -> Period:
        self.period_requests.append(at)
        if self.closed_fallback and len(self.period_requests) > 1:
            return self.closed_fallback
        return self.period

    def week_at(self, at: datetime) -> Period:
        return self.week or self.period

    def leaderboard(self, week: Period | None) -> Leaderboard:
        key = week.id if week else None
        return self.leaderboards.get(key, Leaderboard(rows=(), total_players=3))

    def find(self, sighting_id: UUID) -> Sighting | None:
        return self.sightings.get(sighting_id)

    def insert(self, new: NewSighting) -> Sighting:
        self.inserted.append(new)
        existing = self.sightings.get(new.id)
        if existing:
            return existing
        sighting = Sighting(
            id=new.id,
            player_id=new.player_id,
            photo_path=new.photo_path,
            taken_at=new.taken_at,
            claim_type=new.claim_type,
            categories=new.categories,
            points=new.points,
            status="waiting_review",
            flagged=False,
        )
        self.sightings[new.id] = sighting
        before = self.standings.get(new.player_id, EMPTY_STANDING)
        self.standings[new.player_id] = replace(
            before,
            points=before.points + new.points,
            count=before.count + 1,
            last_photo_path=new.photo_path,
        )
        return sighting

    def standing(self, player_id: UUID, period: Period) -> Standing:
        return self.standings.get(player_id, EMPTY_STANDING)


class FakePhotoStore:
    def __init__(self) -> None:
        self.uploads: dict[str, bytes] = {}
        self.fail: Exception | None = None

    def upload(self, path: str, photo: bytes) -> None:
        if self.fail:
            raise self.fail
        self.uploads[path] = photo

    def download(self, path: str) -> bytes:
        if self.fail:
            raise self.fail
        return self.uploads[path]

    def signed_url(self, path: str, expires_in: int) -> str:
        if self.fail:
            raise self.fail
        return f"https://signed.test/{path}?ttl={expires_in}"


class FakeVerificationRepo:
    def __init__(self, pending: list[PendingSighting] | None = None) -> None:
        self.pending = list(pending or [])
        self.outcomes: dict[UUID, Outcome] = {}
        self.retries: dict[UUID, tuple[str, datetime]] = {}
        self.gave_up: dict[UUID, str] = {}
        self.commits = 0

    def claim_due(self, now: datetime, limit: int) -> list[PendingSighting]:
        claimed, self.pending = self.pending[:limit], self.pending[limit:]
        return claimed

    def save_outcome(self, sighting_id: UUID, outcome: Outcome, now: datetime) -> None:
        self.outcomes[sighting_id] = outcome

    def schedule_retry(self, sighting_id: UUID, error: str, next_attempt_at: datetime) -> None:
        self.retries[sighting_id] = (error, next_attempt_at)

    def give_up(self, sighting_id: UUID, error: str, now: datetime) -> None:
        self.gave_up[sighting_id] = error

    def commit(self) -> None:
        self.commits += 1


class FakePhotoChecker:
    def __init__(self, result: CheckResult | None = None) -> None:
        self.result = result
        self.fail: Exception | None = None
        self.checked: list[tuple[bytes, Claim]] = []

    def check(self, photo: bytes, claim: Claim) -> CheckResult:
        self.checked.append((photo, claim))
        if self.fail:
            raise self.fail
        assert self.result
        return self.result
