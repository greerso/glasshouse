# python:3.12.11-slim-bookworm linux/amd64 (thinkstation is x86_64).
# Do not float on python:3.12-slim — Task 10 pins this digest.
FROM python:3.12.11-slim-bookworm@sha256:c00fc7b44d844b6da22861ec24af43968a5200eac4ec607b4725d585165d6b49
RUN pip install --no-cache-dir pgsync==7.3.0
ENTRYPOINT ["pgsync"]
