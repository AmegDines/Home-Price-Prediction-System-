# =============================================================================
# Stage 1 — Builder
# Install Python dependencies into a clean venv so the final image stays lean.
# =============================================================================
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build tooling needed by some wheels (e.g. numpy)
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy only the requirements file first to leverage layer caching
COPY requirements.txt .

# Install into a prefix so we can copy just /install to the final stage
RUN pip install --upgrade pip \
 && pip install --no-cache-dir --prefix=/install -r requirements.txt

# =============================================================================
# Stage 2 — Runtime
# Copy the installed packages and application code into a minimal image.
# =============================================================================
FROM python:3.12-slim AS runtime

# Non-root user for security (Unit V — DevSecOps)
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser

WORKDIR /app

# Pull in pre-built packages from builder stage
COPY --from=builder /install /usr/local

# Copy application source
COPY main.py .
COPY model/ ./model/

# Create writable data directory for SQLite (local dev fallback)
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

# Document which port the server listens on
EXPOSE 8000

# Health check used by Docker Compose and Kubernetes liveness probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

# Start Uvicorn with 2 workers; tune via UVICORN_WORKERS env var
ENV UVICORN_WORKERS=2
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS}"]
