#!/bin/bash
# Supervisor do dev server do OaaS.Quest.
#
# Roda desacoplado do runtime do agente (setsid + nohup): nao morre quando a
# sessao do WSL que o iniciou fecha e nao tem limite de tempo de 1 hora.
#
# A supervision e pela PORTA, nao pelo processo: `bun run dev` fica pendurado
# quando o vite filho morre, entao vigiar o pid nao serviria. Se a porta
# deixar de responder, outro dev server e levantado.
set -u
ROOT=/mnt/d/www/Freelas/_____suissadev/OaaS/OaaS.Quest
LOG=/tmp/oaas-dev.log
PORT=5173
INTERVALO=5

echo "$$" > /tmp/oaas-dev.pid
cd "$ROOT" || exit 1

while true; do
  if ! curl -s -o /dev/null --max-time 3 "http://127.0.0.1:$PORT/"; then
    echo "--- dev server fora do ar em $(date '+%d/%m %H:%M:%S'), subindo ---" >> "$LOG"
    (
      cd "$ROOT" &&
        bun run dev --host 0.0.0.0 --port "$PORT" --strictPort >> "$LOG" 2>&1
    ) &
  fi
  sleep "$INTERVALO"
done
