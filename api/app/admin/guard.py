from typing import Annotated

from fastapi import Depends

from app.auth.allowed_user import get_allowed_user
from app.auth.tokens import CurrentUser
from app.errors import ApiError
from app.me.players_repo import PlayersRepo, get_players_repo


def get_admin_user(
    user: Annotated[CurrentUser, Depends(get_allowed_user)],
    players: Annotated[PlayersRepo, Depends(get_players_repo)],
) -> CurrentUser:
    player = players.get(user.id)
    if player is None or not player.is_admin:
        raise ApiError(403, "not_admin")
    return user
