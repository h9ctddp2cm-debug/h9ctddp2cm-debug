#!/bin/bash
# Validate every inline <script> block in index.html with node --check.
# Run from anywhere: paths resolve relative to this repository.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
python3 - <<'EOF'
import io, re, subprocess, os
s = io.open('index.html', encoding='utf-8').read()
blocks = re.findall(r'<script[^>]*>(.*?)</script>', s, re.S)
os.makedirs('/tmp/chk', exist_ok=True)
bad = 0
for i, b in enumerate(blocks):
    p = '/tmp/chk/b%d.js' % i
    io.open(p, 'w', encoding='utf-8').write(b)
    r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
    print('block %d  %7d bytes  %s' % (i, len(b), 'OK' if r.returncode == 0 else 'FAIL'))
    if r.returncode:
        bad = 1
        print(r.stderr[:1500])
raise SystemExit(bad)
EOF
