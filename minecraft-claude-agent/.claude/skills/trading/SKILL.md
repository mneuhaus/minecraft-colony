---
name: trading
description: Coordinate safe item handoffs with nearby players or bots. Use this when someone requests resources or when you must return gathered materials.
allowed-tools: find_entity, get_position, move_to_position, look_at, list_inventory, find_item, drop_item, collect_nearby_items, send_chat, send_bot_message, read_bot_messages
---

# Trading Skill – Coordinated Item Handoffs

This skill teaches you how to pass items to another player (or bot) in a clear, reliable way.

## Available Tools

- **find_entity(entityType, maxDistance)** – locate nearby players (use `entityType="player"`).
- **get_position()** – know your current coordinates before moving.
- **move_to_position(x, y, z, range)** – walk within 1–2 blocks of the trading partner.
- **look_at(x, y, z)** – face the partner so they see the items appear.
- **list_inventory()** – capture a snapshot of your inventory.
- **find_item(name)** – confirm stack counts before promising items.
- **drop_item(name, count?)** – drop the requested stack (defaults to entire stack).
- **collect_nearby_items(item_types, radius)** – clean up leftovers if the partner cannot carry everything.
- **send_chat(message)** – confirm the transfer and ask clarifying questions.
- **send_bot_message(recipient, message, priority?)** – send an asynchronous message to another bot. The recipient will receive it when they check messages. Priority: low/normal/high.
- **read_bot_messages(mark_as_read?, only_unread?)** – check for messages sent by other bots. Returns unread messages by default.

## Trading Workflow

1. **Clarify the request**
   - Ask who needs the items, what quantities, and where to meet.
   - Use `send_chat` to acknowledge the plan.

2. **Locate the partner**
   - Use `find_entity(entityType="player", maxDistance=30)`.
   - If not found, request coordinates; move closer; repeat until you have visual contact.

3. **Move into trading position**
   - Use `move_to_position(partnerX, partnerY, partnerZ, range=2)`.
   - Call `look_at(partnerX, partnerY, partnerZ)` so trades happen face-to-face.

4. **Verify inventory**
   - Run `list_inventory()` for a fresh snapshot.
   - Check each requested item with `find_item`. If you have less than requested, say so before proceeding.

5. **Drop the items deliberately**
   - Use `drop_item(name="oak_log", count=8)` (adjust name/count per request).
   - Drop one resource type at a time; pause briefly between drops so the partner can pick them up.
   - Step back 1–2 blocks (`move_to_position` with slightly higher range) to keep the pickup zone clear.

6. **Confirm pickup**
   - Watch the floor: if items remain, remind the partner via `send_chat`.
   - If the partner cannot carry everything, offer to hold the remainder or store it.

7. **Handle leftovers**
   - If items linger, recover them with `collect_nearby_items()` so nothing despawns. Ask what to do next.

8. **Notify the recipient (for bot-to-bot trades)**
   - After dropping items, use `send_bot_message` to notify the other bot
   - Example: `send_bot_message("SammelBot", "I dropped 3 oak logs for you at (119, 64, 112)", "normal")`
   - The recipient bot will automatically receive the message within 30 seconds (automatic message checking)
   - No need to tell the recipient to check messages - it happens automatically in the background
   - Messages are delivered as synthetic chat events prefixed with `[Bot Message]`

9. **Close the trade**
   - Summarise the handoff via `send_chat` (e.g., "Dropped 12 cobblestone for you at your feet").
   - Offer follow-up help.

## Best Practices

- Always double-check the recipient’s name when multiple players stand nearby.
- Prefer manageable stack sizes (8–16 items) for multi-item requests to avoid despawn risk.
- Keep the chat log tidy: acknowledge requests, confirm delivery, and note shortages immediately.
- Use diary/log entries (automatically generated when using tools) to maintain traceability.

## When Not to Use This Skill

- If the recipient wants items stored rather than hand-delivered—use or request a storage location instead.
- When players request automated chest transfers or redstone systems; that requires a separate build/storage workflow.
