import asyncio

import pytest

from app.verification.runner import sweep_forever


def test_sweeper_waits_then_runs_repeatedly_and_survives_errors():
    calls: list[int] = []

    def run() -> None:
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("database down")

    async def main() -> None:
        task = asyncio.create_task(sweep_forever(run, first_delay=0.01, interval=0.01))
        await asyncio.sleep(0.2)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(main())

    assert len(calls) >= 2
