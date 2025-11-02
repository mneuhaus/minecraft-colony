#!/bin/bash
# Hook to check if TODO.md tasks are complete
# User directive: "DO NOT STOP until these are working"

TODO_FILE="/Users/mneuhaus/Workspace/minecraft/minecraft-claude-agent/TODO.md"

if [ ! -f "$TODO_FILE" ]; then
    echo "✅ No TODO.md found - nothing to check"
    exit 0
fi

# Count incomplete tasks
INCOMPLETE_COUNT=$(grep -c -- '- \[ \]' "$TODO_FILE" 2>/dev/null || echo 0)

if [ "$INCOMPLETE_COUNT" -gt 0 ]; then
    echo "" >&2
    echo "⚠️  ============================================================" >&2
    echo "⚠️  WARNING: TODO.md has $INCOMPLETE_COUNT incomplete task(s)!" >&2
    echo "⚠️  ============================================================" >&2
    echo "" >&2
    echo "User directive: DO NOT STOP until all tasks are done." >&2
    echo "" >&2
    echo "Incomplete tasks:" >&2
    grep -- '- \[ \]' "$TODO_FILE" | head -10 | sed 's/^/  /' >&2
    echo "" >&2
    echo "Continue working on these tasks before stopping!" >&2
    echo "============================================================" >&2
    exit 2  # Block stopping
else
    echo "✅ DID YOU VERIFY ALL TASKS YOU MARKED AS COMPLETED? PRESENT YOUR EVIDENCE." >&2
    exit 0
fi
