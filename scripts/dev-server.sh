#!/bin/bash
# Sobe o supervisor do dev server do OaaS.Quest.
#
# O padrao `pkill -f "run dev"` casaria com o proprio shell do comando e o
# mataria antes do restart; o colchete no padrao evita o auto-casamento.
set -u
ROOT=/mnt/d/www/Freelas/_____suissadev/OaaS/OaaS.Quest
LOG=/tmp/oaas-dev.log
PORT=5173

# Derruba o supervisor anterior e qualquer vite solto.
if [ -f /tmp/oaas-dev.pid ]; then
  kill "$(cat /tmp/oaas-dev.pid)" 2>/dev/null
fi
pkill -f "dev-supervisor[ ].sh" 2>/dev/null
sleep 1
pkill -f "run[ ]dev" 2>/dev/null
sleep 2
pkill -9 -f "run[ ]dev" 2>/dev/null
sleep 1

: > "$LOG"
cd "$ROOT" || exit 1
setsid nohup bash "$ROOT/scripts/dev-supervisor.sh" > /dev/null 2>&1 < /dev/null &
disown

sleep 8
echo "--- log ---"
cat "$LOG"
echo "--- acessos (dentro do WSL) ---"
for host in 127.0.0.1 localhost; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 6 "http://$host:$PORT/exemplos")
  echo "$host:$PORT -> $code"
done
echo "--- supervisor ---"
cat /tmp/oaas-dev.pid 2>/dev/null
ps -ef | grep -E "dev-supervisor[ ].sh" | grep -v grep
