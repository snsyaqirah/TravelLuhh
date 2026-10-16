#!/usr/bin/env bash
# npm run lint:look — DESIGN-SPEC §12.16. Fails when src/** uses a pattern that makes the app look generated:
# big radii, blur, gradients, blurred shadows, the sparkle/wand/rocket icons, banned fonts, or emoji.
# rounded-full is allowed only in components/ui/avatar.tsx and components/ui/switch.tsx.
set -euo pipefail

cd "$(dirname "$0")/.."
export LC_ALL=C.UTF-8 # grep -P needs UTF-8 mode for the emoji ranges

LOOK='rounded-(xl|2xl|3xl)|backdrop-blur|bg-gradient-|shadow-(sm|md|lg|xl|2xl)\b|Sparkles|Wand2|Rocket|font-\['"'"'?Inter|Playfair|[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]'
ROUND='\brounded-full\b'
ROUND_ALLOWED='^src/components/ui/(avatar|switch)\.tsx:'

look_hits=$(grep -rnP --binary-files=without-match "$LOOK" src || true)
round_hits=$(grep -rnP --binary-files=without-match "$ROUND" src | grep -vE "$ROUND_ALLOWED" || true)

count() { if [ -z "$1" ]; then echo 0; else printf '%s\n' "$1" | wc -l | tr -d ' '; fi; }
look_n=$(count "$look_hits")
round_n=$(count "$round_hits")
total=$((look_n + round_n))

if [ "$total" -eq 0 ]; then
  echo "lint:look ok: no banned patterns in src/"
  exit 0
fi

report() {
  local title=$1 hits=$2 n=$3
  [ "$n" -eq 0 ] && return
  echo "$title ($n)"
  printf '%s\n' "$hits" | cut -c1-200 | sed 's/^/  /'
  echo
}

report "Banned look patterns (§12.16)" "$look_hits" "$look_n"
report "rounded-full outside avatar/switch (§5.2)" "$round_hits" "$round_n"

files=$(printf '%s\n%s\n' "$look_hits" "$round_hits" | grep -v '^$' | cut -d: -f1 | sort -u | wc -l | tr -d ' ')
echo "lint:look failed: $total match(es) in $files file(s)."
exit 1
