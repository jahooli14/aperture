#!/bin/bash
# Query debug logs from Supabase database
# Usage: ./query-logs.sh [function-name] [limit]

set -euo pipefail

SUPABASE_URL="${VITE_SUPABASE_URL:-https://zaruvcwdqkqmyscwvxci.supabase.co}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
FUNCTION_NAME="${1:-}"
LIMIT="${2:-50}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$SUPABASE_KEY" ]; then
  echo -e "${RED}❌ Error: SUPABASE_SERVICE_ROLE_KEY not set${NC}"
  echo "This is needed to query the debug_logs table"
  exit 1
fi

echo -e "${BLUE}🔍 Querying Debug Logs${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}Supabase:${NC} $SUPABASE_URL"
[ -n "$FUNCTION_NAME" ] && echo -e "${YELLOW}Function:${NC} $FUNCTION_NAME"
echo -e "${YELLOW}Limit:${NC} $LIMIT entries"
echo ""

# Build query
if [ -n "$FUNCTION_NAME" ]; then
  FILTER="&function_name=eq.$FUNCTION_NAME"
else
  FILTER=""
fi

# Query logs
RESPONSE=$(curl -s \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  "${SUPABASE_URL}/rest/v1/debug_logs?select=*&order=created_at.desc&limit=$LIMIT${FILTER}")

# Check if empty
if echo "$RESPONSE" | jq -e '. | length == 0' > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  No logs found${NC}"
  echo ""
  echo "Possible reasons:"
  echo "  1. No functions have been called yet"
  echo "  2. Functions haven't been updated to use the logger"
  echo "  3. Database table doesn't exist (run migration)"
  exit 0
fi

# Format and display logs
echo "$RESPONSE" | jq -r '.[] |
  "\(.created_at | fromdateiso8601 | strftime("%H:%M:%S")) [\(.level | ascii_upcase)] [\(.function_name)] \(.message)" +
  (if .data then "\n  Data: \(.data | tostring)" else "" end)
' | while IFS= read -r line; do
  # Color-code by level
  if echo "$line" | grep -q "\[ERROR\]"; then
    echo -e "${RED}$line${NC}"
  elif echo "$line" | grep -q "\[WARN\]"; then
    echo -e "${YELLOW}$line${NC}"
  elif echo "$line" | grep -q "✅"; then
    echo -e "${GREEN}$line${NC}"
  else
    echo "$line"
  fi
done

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Count logs
TOTAL=$(echo "$RESPONSE" | jq 'length')
echo -e "${BLUE}Total entries:${NC} $TOTAL"

if [ -n "$FUNCTION_NAME" ]; then
  echo -e "${BLUE}Function:${NC} $FUNCTION_NAME"
fi
