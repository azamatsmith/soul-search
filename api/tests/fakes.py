from dataclasses import replace
from datetime import datetime
from uuid import UUID

from app.auth.lockout import AttemptState
from app.auth.supabase_auth import AuthSession
from app.me.players_repo import NameTaken, Player
from app.sightings.repo import Period


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


class FakeSightingsRepo:
    def __init__(self, period: Period) -> None:
        self.period = period
        self.period_requests: list[datetime] = []

    def period_at(self, at: datetime) -> Period:
        self.period_requests.append(at)
        return self.period
