from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.allowed_user import get_allowed_user
from app.auth.tokens import CurrentUser
from app.errors import ApiError
from app.me.display_name import DisplayNameError, validate_display_name
from app.me.players_repo import NameTaken, Player, PlayersRepo, get_players_repo

router = APIRouter(prefix="/me")

User = Annotated[CurrentUser, Depends(get_allowed_user)]
Players = Annotated[PlayersRepo, Depends(get_players_repo)]


class MeResponse(BaseModel):
    id: UUID
    email: str
    display_name: str | None
    is_admin: bool
    text_size: str
    flagged_count: int | None


class DisplayNameBody(BaseModel):
    display_name: str


def me_response(user: CurrentUser, player: Player | None, players: PlayersRepo) -> MeResponse:
    is_admin = player is not None and player.is_admin
    return MeResponse(
        id=user.id,
        email=user.email,
        display_name=player.display_name if player else None,
        is_admin=is_admin,
        text_size=player.text_size if player else "standard",
        flagged_count=players.flagged_count() if is_admin else None,
    )


@router.get("")
def get_me(user: User, players: Players) -> MeResponse:
    return me_response(user, players.get(user.id), players)


@router.put("/display-name")
def put_display_name(body: DisplayNameBody, user: User, players: Players) -> MeResponse:
    try:
        name = validate_display_name(body.display_name)
    except DisplayNameError as error:
        raise ApiError(422, error.code) from error
    try:
        player = players.save_display_name(user.id, name)
    except NameTaken as error:
        raise ApiError(409, "name_taken") from error
    return me_response(user, player, players)
