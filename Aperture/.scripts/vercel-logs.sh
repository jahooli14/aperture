#!/bin/bash
# Fetch Vercel runtime logs for debugging
# Usage: ./vercel-logs.sh [function-name] [limit]

set -euo pipefail

# Load environment variables from .env if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ -f "$REPO_ROOT/.env" ]; then
  set -a  # automatically export all variables
  source "$REPO_ROOT/.env"
  set +a
fi

# Configuration
VERCEL_TOKEN="${VERCEL_TOKEN:-FWsU3v4DJU8HKGZYb63exOIf}"
PROJECT_ID="${VERCEL_PROJECT_ID:-prj_rkI3NQOI5SfBle7lflFkwFkj0eYd}"
FUNCTION_NAME="${1:-}"
LIMIT="${2:-100}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if token is set
if [ -z "$VERCEL_TOKEN" ] || [ "$VERCEL_TOKEN" = "your_token_here" ]; then
  echo -e "${RED}❌ Error: VERCEL_TOKEN not set${NC}"
  echo "Set it with: export VERCEL_TOKEN=your_token_here"
  echo "Get token from: https://vercel.com/account/tokens"
  exit 1
fi

# Check if project ID is set
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "your_project_id" ]; then
  echo -e "${RED}❌ Error: VERCEL_PROJECT_ID not set${NC}"
  echo "Set it with: export VERCEL_PROJECT_ID=your_project_id"
  echo "Find it in: Vercel Dashboard → Project → Settings"
  exit 1
fi

echo -e "${BLUE}🔍 Fetching Vercel Logs${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}Project ID:${NC} $PROJECT_ID"
[ -n "$FUNCTION_NAME" ] && echo -e "${YELLOW}Function:${NC} $FUNCTION_NAME"
echo -e "${YELLOW}Limit:${NC} $LIMIT entries"
echo ""

# Step 1: Get latest deployment ID
echo -e "${BLUE}→ Getting latest deployment...${NC}"

DEPLOYMENT_RESPONSE=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v6/deployments?projectId=$PROJECT_ID&limit=1")

DEPLOYMENT_ID=$(echo "$DEPLOYMENT_RESPONSE" | grep -o '"uid":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$DEPLOYMENT_ID" ]; then
  echo -e "${RED}❌ Failed to get deployment ID${NC}"
  echo "Response: $DEPLOYMENT_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Deployment ID:${NC} $DEPLOYMENT_ID"
echo ""

# Step 2: Fetch runtime logs
echo -e "${BLUE}→ Fetching runtime logs...${NC}"
echo ""

# Build URL with optional function filter
LOGS_URL="https://api.vercel.com/v3/deployments/$DEPLOYMENT_ID/events?limit=$LIMIT"

# Fetch logs
LOGS_RESPONSE=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "$LOGS_URL")

# Check if response is valid JSON
if ! echo "$LOGS_RESPONSE" | jq empty 2>/dev/null; then
  echo -e "${RED}❌ Invalid JSON response${NC}"
  echo "Response: $LOGS_RESPONSE"
  exit 1
fi

# Parse and format logs
echo "$LOGS_RESPONSE" | jq -r '
  .[] |
  select(.type == "stdout" or .type == "stderr") |
  "\(.date | tonumber / 1000 | strftime("%H:%M:%S")) [\(.type)] \(.payload.text // .text)"
' | while IFS= read -r line; do
  # Filter by function name if provided
  if [ -n "$FUNCTION_NAME" ]; then
    if echo "$line" | grep -qi "$FUNCTION_NAME"; then
      echo "$line"
    fi
  else
    echo "$line"
  fi
done | tail -n "$LIMIT" | while IFS= read -r line; do
  # Color-code log levels
  if echo "$line" | grep -q "\[stderr\]"; then
    echo -e "${RED}$line${NC}"
  elif echo "$line" | grep -q "❌\|Error\|error\|ERROR\|failed\|FAILED"; then
    echo -e "${RED}$line${NC}"
  elif echo "$line" | grep -q "✅\|Success\|success\|complete\|COMPLETE"; then
    echo -e "${GREEN}$line${NC}"
  elif echo "$line" | grep -q "⚠️\|Warning\|warning\|WARN"; then
    echo -e "${YELLOW}$line${NC}"
  else
    echo "$line"
  fi
done

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Logs fetched successfully${NC}"

# Show log count
LOG_COUNT=$(echo "$LOGS_RESPONSE" | jq '[.[] | select(.type == "stdout" or .type == "stderr")] | length')
echo -e "${BLUE}Total entries:${NC} $LOG_COUNT"

if [ -n "$FUNCTION_NAME" ]; then
  FILTERED_COUNT=$(echo "$LOGS_RESPONSE" | jq -r '
    .[] |
    select(.type == "stdout" or .type == "stderr") |
    .payload.text // .text
  ' | grep -ci "$FUNCTION_NAME" || true)
  echo -e "${BLUE}Matching '$FUNCTION_NAME':${NC} $FILTERED_COUNT"
fi
