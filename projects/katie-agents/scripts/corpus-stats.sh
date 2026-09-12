#!/usr/bin/env bash
# Corpus facts, computed rather than asserted.
set -euo pipefail
cd "$(dirname "$0")/../corpus"

echo "notes:        $(ls -1 *.md | wc -l | tr -d ' ')"
echo "words:        $(cat *.md | wc -w | tr -d ' ')"
echo "date range:   $(ls -1 *.md | sed 's/^\(....-..-..\).*/\1/' | sort | head -1) .. $(ls -1 *.md | sed 's/^\(....-..-..\).*/\1/' | sort | tail -1)"
echo "admin/noise:  $(grep -Lil -e '"' *.md | wc -l | tr -d ' ') notes contain no quoted speech"
echo
echo "notes per month:"
ls -1 *.md | sed 's/^\(....-..\).*/  \1/' | sort | uniq -c | awk '{print $2"  "$1}'
echo
echo "orgs by note count:"
for o in ravensbourne thackeray harrow-point bellwether copperfield nine-elms aldgate \
         pemberton ashfield trans-meridian kestrel lattice fenwick duraflex norton-hale \
         severn whitcombe castleford pallister orwell sandbrook hexley; do
  c=$(ls -1 *"$o"*.md 2>/dev/null | wc -l | tr -d ' ')
  [ "$c" -gt 0 ] && printf '  %-16s %s\n' "$o" "$c"
done
