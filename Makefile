.PHONY: install web api lint fmt test

install:
	cd web && npm ci
	cd api && uv sync

web:
	cd web && npm run dev

api:
	cd api && uv run $(if $(wildcard api/.env),--env-file .env) fastapi dev app/main.py --port 8000

lint:
	cd web && npm run lint && npm run format:check && npm run typecheck
	cd api && uv run ruff check . && uv run ruff format --check .

fmt:
	cd web && npm run format
	cd api && uv run ruff format . && uv run ruff check --fix .

test:
	cd web && npm test
	cd api && uv run pytest
