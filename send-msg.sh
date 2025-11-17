#!/bin/bash
# Helper script to send system messages to bots
# Usage: ./send-msg.sh "message text" [bot_name]

if [ -z "$1" ]; then
  echo "Usage: $0 \"message text\" [bot_name]"
  exit 1
fi

MESSAGE="$1"
BOT_NAME="${2:-Kubo}"
API_URL="http://localhost:4242/api/bots/$BOT_NAME/message"

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"$MESSAGE\"}" \
  --silent --show-error | jq -r '.message // .error // .'
