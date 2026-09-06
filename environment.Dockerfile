# DocIntel Bench environment image.
#
# The repository is supplied by the platform at /app, so this file only installs
# dependencies. It must serve both halves of the stack, and no single language
# default carries both: python:3.12-slim has no Node, node:24-bookworm-slim ships
# Python 3.11 (below the project's requires-python >= 3.12), and Debian's apt
# offers only nodejs 20. This base is pinned by digest and provides
# Python 3.12.14 and Node v24.20.0, matching backend/Dockerfile and
# frontend/Dockerfile exactly.
FROM nikolaik/python-nodejs@sha256:533a583ad1d2b8de20bfbf26cc3c5d4f61c56135d8a0cf1dff83d91ebd93b68f

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    NPM_CONFIG_CACHE=/opt/npm-cache \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

# git is needed to inspect the checkout; the base image does not include it.
RUN apt-get update \
 && apt-get install --no-install-recommends -y git=1:2.47.3-0+deb13u1 \
 && rm -rf /var/lib/apt/lists/*

# Backend runtime dependencies, mirroring backend/pyproject.toml.
RUN pip install --no-cache-dir \
      "fastapi==0.115.12" \
      "uvicorn[standard]==0.34.2" \
      "sqlalchemy==2.0.40" \
      "alembic==1.15.2" \
      "psycopg[binary]==3.2.6" \
      "redis==5.2.1" \
      "celery==5.5.1" \
      "pydantic==2.11.3" \
      "pydantic-settings==2.8.1" \
      "python-multipart==0.0.20" \
      "argon2-cffi==23.1.0" \
      "PyJWT==2.10.1" \
      "jsonschema==4.23.0" \
      "httpx==0.28.1" \
      "Pillow==11.2.1" \
      "PyMuPDF==1.25.5" \
      "boto3==1.37.38" \
      "email-validator==2.2.0"

# Backend test extras, mirroring the [test] optional dependency group.
RUN pip install --no-cache-dir \
      "pytest==8.3.5" \
      "pytest-cov==6.1.1" \
      "ruff==0.11.6"

# Warm the npm cache with the frontend dependency tree, mirroring
# frontend/package.json. The resolved tree itself is discarded: a task runs
# `npm ci` against the repository's own package-lock.json, which stays the single
# source of truth for exact versions while the tarballs come from this cache.
RUN mkdir -p /opt/npm-prime \
 && cd /opt/npm-prime \
 && npm install --save-exact \
      react@19.0.0 \
      react-dom@19.0.0 \
      react-router-dom@7.5.0 \
      lucide-react@0.468.0 \
      @types/react@19.0.12 \
      @types/react-dom@19.0.4 \
      @vitejs/plugin-react@4.4.1 \
      @testing-library/react@16.3.0 \
      @testing-library/jest-dom@6.6.3 \
      @testing-library/user-event@14.6.1 \
      jsdom@26.1.0 \
      typescript@5.8.3 \
      vite@6.3.0 \
      vitest@3.1.1 \
 && rm -rf /opt/npm-prime

WORKDIR /app
