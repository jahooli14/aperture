#!/bin/bash
cd /Users/danielcroome-horgan/aperture/agentic-swarm
npx tsx build-insurance-digest.ts 2>&1 | tee build-log.txt
