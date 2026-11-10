#!/usr/bin/env bash
set -e
cd /mnt/d/www/Freelas/_____suissadev/OaaS/OaaS.Quest
mkdir -p fonts
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
curl -s -H "User-Agent: $UA" "https://fonts.googleapis.com/css2?family=Archivo:wght@100..900&family=Spline+Sans+Mono:wght@300..800&display=swap" -o /tmp/gf.css
echo "--- subsets found ---"
grep -c "@font-face" /tmp/gf.css
grep -B6 "U+0000-00FF" /tmp/gf.css | grep -o "https://[^)]*" | head -4
