#!/bin/bash
cd /mnt/d/www/Freelas/_____suissadev/OaaS/OaaS-atual

echo "=== rolldown instalado? ==="
ls node_modules/rolldown/ 2>/dev/null | head -10 || echo "NÃO ENCONTRADO"

echo ""
echo "=== Plugin do rolldown no index.d.ts do vite (linha 2061 +/-) ==="
sed -n '2055,2075p' node_modules/vite/dist/node/index.d.ts

echo ""
echo "=== import rolldown no topo do index.d.ts ==="
head -20 node_modules/vite/dist/node/index.d.ts

echo ""
echo "=== testar typecheck com verbose ==="
./node_modules/.bin/tsc --noEmit -p tsconfig.node.json --extendedDiagnostics 2>&1 | tail -20
