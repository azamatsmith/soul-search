from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends

from app.admin.challenges_repo import ChallengesRepo, get_challenges_repo
from app.admin.challenges_routes import ChallengeOut, challenge_out
from app.auth.allowed_user import get_allowed_user
from app.auth.tokens import CurrentUser
from app.clock import get_now

router = APIRouter(prefix="/challenges")

User = Annotated[CurrentUser, Depends(get_allowed_user)]
Challenges = Annotated[ChallengesRepo, Depends(get_challenges_repo)]
Now = Annotated[datetime, Depends(get_now)]


@router.get("/upcoming")
def list_upcoming(_user: User, challenges: Challenges, now: Now) -> list[ChallengeOut]:
    return [challenge_out(challenge) for challenge in challenges.upcoming(now)]
