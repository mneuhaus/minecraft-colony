# System Message Helper

Send interrupting system messages directly to the bot's conversation using the REST API.

## Usage

```bash
./send-msg.sh "your message here" [bot_name]
```

- **Message**: Any text you want to send to the bot
- **Bot name**: Optional, defaults to "Kubo"

## Examples

```bash
# Simple command
./send-msg.sh "debug_pathfinder"

# Longer instruction
./send-msg.sh "Go to the scaffolding tower and call debug_pathfinder"

# Send to a different bot
./send-msg.sh "Hello" "SomeOtherBot"
```

## How it works

- Sends a POST request to `http://localhost:4242/api/bots/{bot_name}/message`
- Message is queued as a high-priority system interrupt
- If the bot is currently processing, it will abort and handle your message immediately
- Messages appear in the bot's conversation with username "SYSTEM"

## API Endpoint

**POST** `/api/bots/:name/message`

```json
{
  "message": "your message text"
}
```

Response:
```json
{
  "success": true,
  "message": "System message sent to Kubo"
}
```

## Direct curl usage

```bash
curl -X POST "http://localhost:4242/api/bots/Kubo/message" \
  -H "Content-Type: application/json" \
  -d '{"message": "debug_pathfinder"}'
```
