.PHONY: dev test lint migrate seed reset-db stop
dev:
	docker compose up --build

test:
	docker compose run --rm --no-deps api pytest
	docker compose run --rm --no-deps frontend npm test -- --run

lint:
	docker compose run --rm --no-deps api ruff check app tests
	docker compose run --rm --no-deps frontend npm run typecheck

migrate:
	docker compose run --rm api alembic upgrade head

seed:
	docker compose exec api python -m app.cli.seed

stop:
	docker compose down

reset-db:
	@test "$(CONFIRM)" = "yes" || (echo "This deletes local database, Redis, and uploaded documents. Run make reset-db CONFIRM=yes"; exit 1)
	docker compose down --volumes
	docker compose up -d --build
