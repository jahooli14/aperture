#!/usr/bin/env bash
# Injected on every prompt. CLAUDE.md says "concise, plain English" and it
# still drifts long over a session, so the rule gets restated every turn rather
# than once at the top of a file that scrolls out of attention.
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"RESPONSE STYLE (applies to this reply):\n- Plain English. Every word earns its place. Cut it if it doesn't.\n- Lead with the answer. No preamble, no recap of what was asked, no summary of what you just did unless asked.\n- Around three bullets is usually right. Use fewer when fewer will do; use prose when bullets would fragment one idea. Never pad to three.\n- No bold-label bullets that restate the bullet. No closing offer of further help.\n- Say what you did and why, once."}}
JSON
