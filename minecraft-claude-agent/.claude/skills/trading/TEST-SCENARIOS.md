# Trading Skill – Test Scenarios

Use these scenarios to verify cross-bot trading. Trigger them via chat (`pnpm send`) and review `logs/<BotName>/` for YAML/diary evidence.

## Scenario 1: Basic Item Hand-off
1. Ensure trader bot has at least 5 oak logs (`pnpm send "@ClaudeTrader list inventory"`).
2. Command: `@ClaudeTrader please bring 3 oak logs to ClaudeExplorer.`
3. Expectation:
   - Trader locates `ClaudeExplorer` (find_entity).
   - Moves within 2 blocks and faces them.
   - Drops 3 logs (`drop_item`).
   - Confirms completion via chat.
   - Diary logs the trade.

## Scenario 2: Coordinate Drop at Position
1. Position `ClaudeExplorer` 15 blocks away, note coordinates.
2. Command: `@ClaudeTrader deliver 4 sticks to ClaudeExplorer at <x> <y> <z> and confirm.`
3. Expectation:
   - Trader pathfinds to target.
   - Drops the requested stack, waits briefly, confirms.
   - If partner does not pick up, trader re-collects and reports.

## Scenario 3: Inventory Shortage Handling
1. Remove saplings from trader inventory (`@ClaudeTrader drop saplings` or manually adjust).
2. Command: `@ClaudeTrader hand over 2 oak saplings to ClaudeExplorer.`
3. Expectation:
   - Trader uses `find_item`, detects shortage.
   - Communicates shortage via chat, logs the failure.
   - Does **not** drop anything.

## Scenario 4: Leftover Recovery
1. Give trader 12 dirt blocks.
2. Command: `@ClaudeTrader drop 12 dirt for ClaudeExplorer.`
3. Partner leaves dirt untouched for 15 seconds.
4. Expectation:
   - Trader waits, sees items still present, collects them back (`collect_nearby_items`).
   - Reports recovery and asks for further instructions.

## Scenario 5: Multi-item Delivery
1. Ensure inventory contains logs and a tool (e.g., stone axe).
2. Command: `@ClaudeTrader deliver 5 oak logs and 1 stone axe to ClaudeExplorer.`
3. Expectation:
   - Trader sequences the drop (logs first, then tool).
   - Confirms each hand-off and provides final summary via chat.
