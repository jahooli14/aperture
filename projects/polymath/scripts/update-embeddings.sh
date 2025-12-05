#!/bin/bash

# Update Embeddings Script
# Runs the backfill script to update embeddings for all items.
# Can be run via cron (weekly/monthly).

echo "Starting Embedding Update..."

# Ensure we are in the project root
cd "$(dirname "$0")/../.."

# Run backfill for all types, updating existing embeddings
# Limit to 500 items to avoid hitting rate limits or timeouts in one go
npm run backfill:embeddings -- --type=all --re-embed --limit=500

echo "Embedding Update Complete."
