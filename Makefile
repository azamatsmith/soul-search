.PHONY: install web api db-start db-stop db-reset db-test db-api-test lint fmt test

install:
	npm ci
	cd web && npm ci
	cd api && uv sync

web:
	cd web && npm run dev

api:
	cd api && uv run --env-file .env.development $(if $(wildcard api/.env.local),--env-file .env.local) fastapi dev app/main.py --port 8000

db-start:
	npx supabase start

db-stop:
	npx supabase stop

db-reset:
	npx supabase db reset

db-test:
	npx supabase test db

db-api-test:
	cd api && uv run pytest -m db

lint:
	cd web && npm run lint && npm run format:check && npm run typecheck
	cd api && uv run ruff check . && uv run ruff format --check .

fmt:
	cd web && npm run format
	cd api && uv run ruff format . && uv run ruff check --fix .

test:
	cd web && npm test
	cd api && uv run pytest
