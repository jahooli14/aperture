#!/bin/bash
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphcnV2Y3dkcWtxbXlzY3d2eGNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA2MDA1NSwiZXhwIjoyMDc1NjM2MDU1fQ.wVlfAHWL8sQ9RyeJisCdej9D9-eJA45VszTLcb86HD4"

curl -s \
  -H "apikey: ${KEY}" \
  -H "Authorization: Bearer ${KEY}" \
  'https://zaruvcwdqkqmyscwvxci.supabase.co/rest/v1/debug_logs?select=*&order=created_at.desc&limit=20' \
  | jq '.'
