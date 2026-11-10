#!/usr/bin/env bash
set -euo pipefail
cd /mnt/d/www/Freelas/_____suissadev/OaaS/OaaS.Quest
echo "=== typecheck ==="
bun run typecheck
echo "=== test ==="
bun run test
echo "=== build ==="
bun run build
echo "=== ok ==="
