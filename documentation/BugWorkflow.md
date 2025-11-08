# Bot Issue Workflow

This workflow keeps the bot and operator in sync when something breaks.

1. **Bot reports the bug**
   - Bot calls the `report_bug` MCP tool with a concise title + markdown description (repro steps, impact, context).
   - Tool persists the issue in `colony.db` and it appears in `/issues` on the dashboard.

2. **Operator triage**
   - Open the Issues modal in the dashboard.
   - Review new items (state `open`, assigned to `system`).
   - Set severity/state, optionally reassign to yourself for investigation.

3. **Investigation + fix**
   - Reproduce locally, fix code/tests as usual.
   - Keep notes (logs, job IDs, screenshots) for the bot – it only sees what we report back.

4. **Report back to the bot**
   - Add a `system` comment on the issue with:
     - Summary of fix
     - Any follow-up steps the bot should test
     - Request to verify
   - Reassign issue to the bot (`assigned_bot = bot name`) and set state to `testing`.

5. **Bot verification**
   - Bot polls using `list_issues` / `get_issue` tools.
   - When an issue is assigned to it, it reruns the scenario and adds a comment with results.
   - If fixed → bot sets state `resolved` or `closed`. If still failing → adds details and reassigns back to operator.

Repeat as needed. This keeps the conversation logged in the issue thread so both human and bot have a shared history.
