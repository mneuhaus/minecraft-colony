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
    echo ""
    echo "⚠️  ============================================================"
    echo "⚠️  WARNING: TODO.md has $INCOMPLETE_COUNT incomplete task(s)!"
    echo "⚠️  ============================================================"
    echo ""
    echo "User directive: DO NOT STOP until all tasks are done."
    echo ""
    echo "Incomplete tasks:"
    grep -- '- \[ \]' "$TODO_FILE" | head -10 | sed 's/^/  /'
    echo ""
    echo "Continue working on these tasks before stopping!"
    echo "============================================================"
    exit 2  # Block stopping
else
    echo "✅ All TODO.md tasks are complete! Safe to stop."
    exit 0
fi
