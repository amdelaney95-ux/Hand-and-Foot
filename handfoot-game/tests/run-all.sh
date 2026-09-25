#!/usr/bin/env bash
# Full verification pass for handfoot.html.
#   1. syntax-checks the whole inline <script>
#   2. re-extracts the engine into tests/engine.js
#   3. runs every test file
#
# Usage (from repo root):  bash tests/run-all.sh
# Requires: node, python3. The end-to-end sync test also needs jsdom (`cd tests && npm install`);
# without it that one suite reports SKIPPED and everything else still runs.

set -u
cd "$(dirname "$0")/.." || exit 1

echo "=== 1. Syntax check of handfoot.html's script block ==="
python3 - <<'PY'
import re, sys
html = open('handfoot.html', encoding='utf-8').read()
m = re.search(r'<script>(.*)</script>', html, re.S)
if not m:
    sys.exit('ERROR: no <script> block found')
open('/tmp/_hf_syntax_check.js', 'w', encoding='utf-8').write(m.group(1))
PY
if ! node --check /tmp/_hf_syntax_check.js; then
  echo "SYNTAX ERROR — stopping."
  exit 1
fi
echo "syntax OK"
echo

echo "=== 2. Extracting engine ==="
python3 tests/extract-engine.py || exit 1
echo

echo "=== 3. Running tests ==="
cd tests || exit 1
FAILED=0
SKIPPED=0
for f in test*.js; do
  # engine.js is the extracted engine, not a test
  [ "$f" = "engine.js" ] && continue
  OUT="$(node "$f" 2>&1)"
  if echo "$OUT" | grep -q "^SKIPPED"; then
    echo "SKIPPED: $f — $(echo "$OUT" | head -1 | sed 's/^SKIPPED: //')"
    SKIPPED=1
  elif echo "$OUT" | grep -q "TEST(S) FAILED"; then
    echo "FAILED: $f"
    echo "$OUT" | grep "FAIL:"
    FAILED=1
  elif echo "$OUT" | grep -q "ALL TESTS PASSED"; then
    echo "passed: $f"
  else
    # test.js is the card-conservation simulation; it prints per-table-size results
    # rather than a PASS/FAIL banner. It throws on a conservation violation.
    if echo "$OUT" | grep -q "ERROR:"; then
      echo "FAILED: $f"
      echo "$OUT"
      FAILED=1
    else
      echo "passed: $f (simulation)"
    fi
  fi
done

echo
if [ "$FAILED" -eq 0 ]; then
  echo "ALL SUITES PASSED"
  [ "$SKIPPED" -eq 1 ] && echo "(some suites were skipped — run \`cd tests && npm install\` to enable them)"
else
  echo "SOME SUITES FAILED (see above)"
fi
exit "$FAILED"
