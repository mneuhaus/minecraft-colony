# CraftScript — Language Specification (v0.1)

**Purpose:**
CraftScript is a small, safe, C-style scripting language for controlling Minecraft bots.
It’s readable for humans, simple for LLMs, and maps directly onto Mineflayer & the Minecraft registry.

---

## 0) Principles

| Design goal | Description |
|--------------|-------------|
| **Readable** | familiar C/JavaScript syntax |
| **Deterministic** | no randomness, no hidden state |
| **Minecraft-native** | real registry IDs (`"minecraft:stone"`) and faces (`"up"`, `"north"`) |
| **Coordinates** | direct coordinates `(x,y,z)` for absolute positions; selectors `f/r/u/b/l/d` for relative |
| **Safe** | executor enforces invariants; never damages itself |
| **LLM-friendly** | few keywords, small grammar, clear errors |

---

## 1) Lexical rules

| Element | Example |
|----------|----------|
| **Comments** | `// line`, `/* block */` |
| **Identifiers** | `build_stairs`, `safe_move` |
| **Keywords** | `macro`, `if`, `else`, `while`, `repeat`, `assert`, `true`, `false` |
| **Literals** | `"minecraft:oak_log"`, `"home"`, `42`, `true`, `false` |
| **Operators** | `!`, `&&`, `||` |
| **Statement end** | `;` |

---

## 2) Selectors (relative block addressing)

| Axis | Meaning | Example |
|------|----------|---------|
| `f` | forward | `f1` |
| `b` | backward | `b2` |
| `r` | right | `r-1` |
| `l` | left | `l2` |
| `u` | up | `u3` |
| `d` | down | `d1` |

Combine with `+`:
`f2+u1+r-1` → “two forward, one up, one left”

Shortcuts:
- `f1^` → step forward & up
- `f1_` → step forward & down

Selectors are always **relative to current heading**.

---

## 3) Statements

| Type | Example |
|-------|---------|
| **command** | `dig(f1+u2);` |
| **assert** | `assert(can_stand(f1), "no floor");` |
| **repeat (count)** | `repeat(6) { dig(f1+u2); move(f1^); }` |
| **repeat (var: limit)** | `repeat(i: 5) { place("dirt", 100+i, 64, 80); }` |
| **repeat (var: range)** | `repeat(x: 0..10:2) { /* even x */ }` |
| **let** | `let ox = 113;` |
| **assign** | `ox = ox + 6;` |
| **while** | `while (!is_air(f1)) { dig(f1); }` |
| **if/else** | `if (safe_step_up(f1)) { move(f1^); } else { dig(f1); }` |
| **block** | `{ ... }` |
| **empty** | `;` |

### Variables & arithmetic
- `let name = expr;` declares a variable (block‑scoped).
- `name = expr;` assigns a new value.
- Arithmetic supported: `+ - * /` with normal precedence and parentheses.
- Repeat variants:
  - `repeat(N) { ... }` legacy count
  - `repeat(i: N) { ... }` i ⇒ 0..N‑1
  - `repeat(i: A..B[:S]) { ... }` i from A to B inclusive with optional step S

---

## 4) Built-in commands (all lowercase)

### movement & orientation

```c
move(f1);        // forward
move(f1^);       // step up
move(f1_);       // step down
turn(r90);
turn(l90);
turn(180);
turn_face("north");   // absolute
```

### world interaction

```c
dig(f1+u2);                        // dig using selector
dig(106, 67, 82);                  // dig using absolute coordinates
break(f1+u2);                      // alias for dig (better for breaking logs)
place("minecraft:cobblestone", f1+u1, face:"up");  // place using selector
place("minecraft:stone", 106, 67, 82);             // place using coordinates
equip("minecraft:iron_pickaxe");
build_up();                        // jump and place block beneath (auto-selects material)
build_up("dirt");                  // jump and place specific block beneath
pickup_blocks();                   // collect dropped items within 8 blocks
pickup_blocks(16);                 // collect dropped items within 16 blocks
scan(r:2);                         // refresh local voxel snapshot
block_info(f1);                    // (new) log compact info for block at selector
block_info(113, 64, 114);          // (new) log compact info for block at world coords
```

### navigation (mineflayer-pathfinder)

```c
goto(140, 64, 92, tol:1);          // goto using absolute coordinates
goto(waypoint("home"), tol:1);     // goto using waypoint
goto(f6, tol:1);                   // goto using selector
```

### crafting & containers

```c
craft("stick", 4);                 // craft 4 sticks
craft("crafting_table");           // craft 1 crafting table
plant("oak_sapling", 100, 64, 50); // plant sapling at coordinates
wait(10000);                       // wait 10 seconds

// Container interaction (chests, barrels, shulkers, furnaces, etc.)
open_container(100, 64, 50);       // open at position (alias: open)
container_put("input", "iron_ore", 8);   // furnace input
container_put("fuel", "coal", 2);        // furnace fuel
container_items();                 // list contents
container_take("output", 8);       // furnace output
close_container();                 // close (alias: close)

// Convenience shorthands (no slot numbers needed)
deposit(100, 64, 50, "oak_log", 32); // open → deposit → close
deposit("oak_log");                  // deposit all of that item into currently open container
withdraw(100, 64, 50, "oak_log", 8); // open → withdraw → close
withdraw("oak_log", 8);              // withdraw from currently open container

// Variable coordinates are supported (expressions evaluated)
let cx = 113; let cy = 64; let cz = 114;
deposit(cx, cy, cz, "oak_log", 16);
withdraw(cx, cy, cz, "oak_sapling", 8);
```

### debugging & logging

```c
log("start planting at", px, pz);  // (new) append a log line to the CraftScript Logs panel
block_info(f1);                     // (new) logs block summary (id/display/hardness/diggable) at target
```

Notes:
- Both `log(...)` and `block_info(...)` produce `craftscript_trace` entries that appear in the CraftScript card’s Show Logs pane. They also return `ok` steps with notes.
- Use these to make test scripts self-describing and to capture ground truth inline without separate tools.

### inventory / utilities

```c
drop("minecraft:cobblestone", count:4);
eat("minecraft:cooked_beef");
```

---

## 5) Predicates (boolean, read-only)

| Predicate                    | Description                      |
| ---------------------------- | -------------------------------- |
| `safe_step_up(sel)`          | true if stepping up is safe      |
| `safe_step_down(sel)`        | true if stepping down is safe    |
| `can_stand(sel)`             | true if solid floor & clear head |
| `is_air(sel)`                | true if block is air             |
| `has_item("minecraft:item")` | true if item present             |
| `is_hazard("lava_near")`     | true if hazard detected          |
| `block_is(pos, id)`          | true if the block at a selector or at world `(x,y,z)` matches id (e.g., "grass_block" or "minecraft:grass_block") |

All use the latest voxel cache; executor auto-scans when stale.

---

## 6) Safety invariants (executor-enforced)

1. `move(f1^)` only if `safe_step_up(f1)`
2. `move(f1_)` only if `safe_step_down(f1)`
3. Don’t `dig(u1|u2)` if gravity blocks overhead
4. Don’t open to `"minecraft:lava"` without plug/fill plan
5. Auto-`scan(r=2)` before risky actions (`dig`, `place`, `move^/_`)

Violation ⇒ error `invariant_violation`.

---

## 7) Errors

**Success**

```json
{ "ok": true, "op": "dig", "ms": 43, "notes": { "selector": "f1+u2", "id": "minecraft:dirt" } }
```

**Failure**

```json
{
  "ok": false,
  "error": "move_blocked|timeout|no_path|invariant_violation",
  "message": "front block solid: minecraft:stone",
  "loc": { "line":7, "column":5 },
  "op_index": 23,
  "at": { "selector":"f1", "world":[129,64,85] },
  "ts": 1710000123
}
```

Executor aborts on first failure. On slow servers, transient timeouts are retried with backoff for placing/planting (`place_timeout`) and container opens (`container_timeout`).

Every failure includes precise metadata:

```json
{
  "ok": false,
  "error": "no_target",
  "message": "no block to dig",
  "op": "break",
  "op_index": 2,
  "loc": { "line": 4, "column": 1 },
  "notes": { "pos": [102,64,108] },
  "ts": 1762542317046
}
```

## 7.1) Debugging & Logs

- CraftScript card bundles everything for the job; the main timeline hides internal noise.
  - Use “Show Logs” on the CraftScript card to see:
    - `repeat_init`, `repeat_iter`, `repeat_end` (loop values)
    - `if` → true/false
    - `var_set` (let/assign)
    - `predicate` evaluations (e.g., `block_is`)
    - `log` lines (from `log(...)`), `block_info` summaries
    - `ok`/`fail` with notes (e.g., `place_timeout`, `container_timeout` with context)
- Status (running/completed/failed/canceled) is displayed on the originating CraftScript card; separate status cards are suppressed in the feed.
- Programmatic access: use the MCP tool `craftscript_logs { job_id }` to fetch a consolidated JSON with `status`, `error`, and full ordered log list (status + steps + traces) for a job.

---

## 8) Macros

Reusable code blocks.

```c
macro build_stairs(int steps) {
  repeat(steps) {
    if (safe_step_up(f1)) {
      dig(f1+u2);
      move(f1^);
    } else {
      assert(false, "cannot step up");
    }
  }
}
```

### Core macros provided

* `stair_up_step()`
* `stair_down_step()`
* `tunnel_forward()`
* `build_pillar(int h)`
* `descend_pillar_safely(int h)`
* `torch_cadence_7()`

---

## 9) Execution model

* Sequential interpreter; aborts on first hard error.
* Loops capped (e.g. 10 000 ops).
* Cache invalidated on `move`, `dig`, `place`, `goto`.
* `goto` uses mineflayer-pathfinder (blocking).
* No concurrency; planner handles parallel jobs.

---

## 10) Examples — Logging & Inspection

### A) Log progress in a planting grid

```c
// Plant oak saplings on a 6‑block grid with logging
let ox = 113; let oy = 64; let oz = 114;

repeat(ix: 0..4) {
  repeat(iz: 0..3) {
    let px = ox + ix * 6; let pz = oz + iz * 6;
    log("check spot", px, oy, pz);

    // Inspect ground; log what’s underfoot
    block_info(px, oy - 1, pz);

    if (block_is(px, oy - 1, pz, "dirt") || block_is(px, oy - 1, pz, "grass_block")) {
      log("planting at", px, pz);
      goto(px, oy, pz, tol:1);
      plant("oak_sapling", px, oy, pz);
    } else {
      log("skip — not dirt/grass", px, pz);
    }
  }
}
```

What you’ll see in Logs:
- `log` lines for each cell (“check spot …”, “planting …”, “skip …”)
- `block_info` summaries (e.g. `grass_block @ 119,63,120`)
- `ok`/`fail` steps if actions succeed/fail

### B) Tree pillar with stepwise logs

```c
// Approach, climb, break top‑down with verbose logs
let tx=102; let ty=64; let tz=108;

log("goto base", tx, ty, tz);
goto(tx, ty, tz, tol:1);

// Confirm there’s wood nearby (logs each level)
repeat(py: ty..(ty+10)) {
  if (block_is(tx, py, tz, "oak_log")) {
    log("found log at y=", py);
    break(tx, py, tz);
  }
}

// Build up twice and log
log("build_up #1"); build_up();
log("build_up #2"); build_up();

// Inspect the block above before breaking
block_info(tx, ty+2, tz);
```

### C) Minimal logging smoke‑test

```c
log("hello", 1, 2, 3);
block_info(f1);
```

Use cases:
- Write self‑describing test scripts.
- Capture ground truth inline without separate tools.
- Pair with `craftscript_logs { job_id }` (MCP) to fetch consolidated JSON for assertions.

## 10) Integration mapping (mineflayer / MCP)

| CraftScript command | Implementation                             |
| ------------------- | ------------------------------------------ |
| `move`              | step solver or small motion                |
| `dig`               | `bot.dig(blockAt(world))`                  |
| `place`             | `bot.placeBlock(block, vecFromFace(face))` |
| `equip`             | `bot.equip(itemId, 'hand')`                |
| `scan`              | call `get_vox`                             |
| `goto`              | call `nav(action:'start')`                 |
| `turn*`             | adjust yaw                                 |

IDs and faces always passed **unchanged** (`"minecraft:..."`, `"up"`, etc.).

---

## 11) Example scripts

### A. Staircase to surface

```c
macro stair_up_step() {
  assert(safe_step_up(f1), "no safe step");
  dig(f1+u2);
  move(f1^);
}

repeat(12) { stair_up_step(); }
```

### B. Go to waypoint and place torch

```c
goto(waypoint("home"), tol:1);
if (has_item("minecraft:torch")) {
  place("minecraft:torch", r1, face:"west");
}
```

### C. Build and remove pillar

```c
build_pillar(4);
place("minecraft:oak_planks", f1+u1, face:"up");
descend_pillar_safely(4);
```

### D. Plant saplings on a 6-block grid (only on dirt)

```c
// Choose origin and planting Y level
let ox = 113; let oy = 64; let oz = 114;

// 5×4 grid, spacing 6 blocks; plant only on dirt ground
repeat(ix: 0..4) {
  repeat(iz: 0..3) {
    let px = ox + ix * 6;
    let pz = oz + iz * 6;
    if (block_is(px, oy - 1, pz, "dirt")) {
      plant("oak_sapling", px, oy, pz);
    }
  }
}
```

### E. Build up a 6‑block radio tower (range loop)

```c
// Start near the target, then build up 6 blocks
goto(140, 64, 92, tol:1);
repeat(h: 1..6) {
  build_up(); // jumps and places beneath using reliable move-listener logic
}
// Mark the top
if (has_item("minecraft:torch")) { place("minecraft:torch", 140, 64+6, 92, face: up); }
```

---

## 12) Grammar outline (Peggy.js)

*(Produces an AST with lowercase command names.)*

```peggy
{
  function node(type, props){ return Object.assign({type,loc:location()}, props||{}); }
}
Start = _ body:StatementList _ { return node("Program",{body}); }
StatementList = s:Statement tail:(_ Statement)* { return [s,...tail.map(t=>t[1])]; } / {return[];}

Statement
  = MacroDecl / IfStmt / RepeatStmt / WhileStmt
  / AssertStmt ";" / CommandStmt ";" / ";" {return node("Empty");}

MacroDecl = "macro" __ name:Identifier _ "(" _ params:ParamList? _ ")" _ blk:Block
  { return node("MacroDecl",{name,params:params||[],body:blk}); }

ParamList = head:Param tail:(_ "," _ Param)* { return [head,...tail.map(t=>t[3])]; }
Param = t:Type __ id:Identifier { return node("Param",{name:id,paramType:t}); }
Type = "int" {return "int";} / "bool" {return "bool";} / "string" {return "string";}

Block = "{" _ body:StatementList? _ "}" { return node("Block",{body:body||[]}); }

IfStmt = "if" _ "(" _ c:Expr _ ")" _ t:Block _ ("else" _ e:Block)?
  { return node("IfStmt",{test:c,consequent:t,alternate:e||null}); }
RepeatStmt = "repeat" _ "(" _ n:Expr _ ")" _ b:Block { return node("RepeatStmt",{count:n,body:b}); }
WhileStmt = "while" _ "(" _ c:Expr _ ")" _ b:Block { return node("WhileStmt",{test:c,body:b}); }
AssertStmt = "assert" _ "(" _ e:Expr _ msg:("," _ m:StringLiteral)? _ ")" { return node("AssertStmt",{test:e,message: msg ? msg[2] : null}); }
CommandStmt = name:Identifier _ "(" _ args:ArgList? _ ")" { return node("Command",{name,args:args||[]}); }

ArgList = head:Arg tail:(_ "," _ Arg)* { return [head,...tail.map(t=>t[3])]; }
Arg = NamedArg / Expr
NamedArg = key:Identifier _ ":" _ val:Expr { return node("NamedArg",{key,value:val}); }

Expr = OrExpr
OrExpr = left:AndExpr tail:(_ "||" _ AndExpr)* { return tail.reduce((a,t)=>node("LogicalExpr",{op:"||",left:a,right:t[3]}),left); }
AndExpr = left:NotExpr tail:(_ "&&" _ NotExpr)* { return tail.reduce((a,t)=>node("LogicalExpr",{op:"&&",left:a,right:t[3]}),left); }
NotExpr = "!" _ e:NotExpr { return node("UnaryExpr",{op:"!",arg:e}); } / Primary

Primary
  = "(" _ e:Expr _ ")" {return e;}
  / PredicateCall / Selector / Waypoint / BlockQuery
  / NumberLiteral / StringLiteral / BooleanLiteral / IdentifierExpr

PredicateCall = name:Identifier _ "(" _ args:ArgList? _ ")" { return node("PredicateCall",{name,args:args||[]}); }
IdentifierExpr = id:Identifier { return node("Identifier",{name:id}); }

Selector = head:SelectorTerm tail:(_ "+" _ SelectorTerm)* { return node("Selector",{terms:[head,...tail.map(t=>t[3])]}); }
SelectorTerm = axis:[FfBbRrLlUuDd] n:SignedInt? { return node("SelTerm",{axis:text().toLowerCase(),n:n!==null?n:1}); }

Waypoint = "waypoint" _ "(" _ n:StringLiteral _ ")" { return node("Waypoint",{name:n}); }
BlockQuery = "block" _ "(" _ kv:NamedArg tail:(_ "," _ NamedArg)* _ ")"
  { const pairs=[kv].concat((tail||[]).map(t=>t[3])); const o={}; for(const p of pairs) o[p.key]=p.value;
    return node("BlockQuery",{query:o}); }

NumberLiteral = n:SignedInt { return node("Number",{value:n}); }
SignedInt = s:"-"? d:[0-9]+ { return parseInt((s||"")+d.join(""),10); }
StringLiteral = "\"" chars:Char* "\"" { return node("String",{value:chars.join("")}); }
Char = "\\\"" {return "\""} / "\\n" {return "\n"} / "\\t" {return "\t"} / !("\"") . {return text();}
BooleanLiteral = "true" {return node("Boolean",{value:true});} / "false" {return node("Boolean",{value:false});}

Identifier = !Keyword id:([a-z_][a-z0-9_]*) { return id.join(""); }
Keyword = "macro" / "if" / "else" / "repeat" / "while" / "assert" / "true" / "false"

_ = (WhiteSpace / Comment)* ; __ = (WhiteSpace / Comment)+
WhiteSpace = [ \t\r\n]+
Comment = "//" [^\n]* "\n"? / "/*" (!"*/" .)* "*/"
```

---

## 13) Custom Functions (Reusable, Versioned Methods)

Custom functions allow bots to create, store, and evolve reusable CraftScript procedures with automatic versioning. Unlike macros (which are script-local), custom functions are **persistent**, **per-bot**, and **version-tracked** in the database.

### Key Features

- **Named Arguments Only**: Functions use key-value syntax for clarity: `fell_oak_tree(type:oak, count:3)`
- **Automatic Versioning**: Every edit creates a new version; always executes the latest
- **Nesting Support**: Functions can call other custom functions (max depth: 10)
- **Per-Bot Scoped**: Each bot maintains its own function library
- **Fail-Fast**: Errors stop execution immediately with clear messages

### Management Tools

| Tool | Description |
|------|-------------|
| `create_craftscript_function` | Define a new function with name, description, args, and body |
| `edit_craftscript_function` | Update function body (auto-increments version) |
| `delete_craftscript_function` | Remove a function and all its versions |
| `list_craftscript_functions` | List all available functions |
| `get_craftscript_function` | View function details and current body |
| `list_function_versions` | Browse version history |

### Tool Usage Examples

#### Creating a Function

```javascript
// Using create_craftscript_function MCP tool
mcp__minecraft__create_craftscript_function({
  name: "fell_oak",
  description: "Fell an oak tree by breaking logs from bottom to top",
  args: [
    { name: "base_x", type: "int", optional: false },
    { name: "base_y", type: "int", optional: false },
    { name: "base_z", type: "int", optional: false },
    { name: "height", type: "int", optional: true, default: 10 }
  ],
  body: `
// Navigate to tree base
goto(base_x, base_y, base_z, tol:1);

// Break logs from bottom to top
repeat(py: base_y..(base_y+height)) {
  if (block_is(base_x, py, base_z, "oak_log")) {
    break(base_x, py, base_z);
    wait(200);
  }
}

// Collect drops
pickup_blocks(16);
  `.trim()
})
// Returns: {"ok": true, "id": 1, "name": "fell_oak", "version": 1}
```

#### Editing a Function (Auto-Versions)

```javascript
// Using edit_craftscript_function MCP tool
mcp__minecraft__edit_craftscript_function({
  name: "fell_oak",
  body: `
// Version 2: Optimized with single wait
goto(base_x, base_y, base_z, tol:1);

repeat(py: base_y..(base_y+height)) {
  if (block_is(base_x, py, base_z, "oak_log")) {
    break(base_x, py, base_z);
  }
}

wait(2000);  // Single wait after all breaks
pickup_blocks(16);
  `.trim(),
  change_summary: "Optimized: batch wait instead of wait per block"
})
// Returns: {"ok": true, "name": "fell_oak", "version": 2}
```

#### Listing Functions

```javascript
// Using list_craftscript_functions MCP tool
mcp__minecraft__list_craftscript_functions()
// Returns:
// {
//   "ok": true,
//   "functions": [
//     {
//       "id": 1,
//       "name": "fell_oak",
//       "description": "Fell an oak tree...",
//       "args": [...],
//       "current_version": 2,
//       "created_at": 1699564800000,
//       "updated_at": 1699568400000
//     }
//   ]
// }
```

#### Getting Function Details

```javascript
// Using get_craftscript_function MCP tool
mcp__minecraft__get_craftscript_function({ name: "fell_oak" })
// Returns full function details including current body
```

#### Viewing Version History

```javascript
// Using list_function_versions MCP tool
mcp__minecraft__list_function_versions({ name: "fell_oak", limit: 10 })
// Returns:
// {
//   "ok": true,
//   "name": "fell_oak",
//   "versions": [
//     {
//       "version": 2,
//       "created_at": 1699568400000,
//       "created_by": "Kubo",
//       "change_summary": "Optimized: batch wait instead of wait per block",
//       "args": [...]
//     },
//     {
//       "version": 1,
//       "created_at": 1699564800000,
//       "created_by": "Kubo",
//       "change_summary": "Initial version",
//       "args": [...]
//     }
//   ]
// }
```

#### Deleting a Function

```javascript
// Using delete_craftscript_function MCP tool
mcp__minecraft__delete_craftscript_function({ name: "fell_oak" })
// Returns: {"ok": true, "deleted": "fell_oak"}
// Note: This removes ALL versions permanently
```

### Function Definition Structure

```json
{
  "name": "fell_oak_tree",
  "description": "Safely fell an oak tree by breaking from bottom to top",
  "args": [
    { "name": "height", "type": "number", "optional": false },
    { "name": "cleanup", "type": "boolean", "optional": true, "default": true }
  ],
  "body": "// CraftScript code here\nrepeat(h: 1..height) {\n  break(f1+u(h));\n}\nif (cleanup) { pickup_blocks(16); }"
}
```

### Example: Creating a Tree-Felling Function

```c
// Initial version: basic tree felling
// Created via: create_craftscript_function({name: "fell_oak", ...})

let base_x = 102;
let base_y = 64;
let base_z = 108;

// Navigate to tree base
goto(base_x, base_y, base_z, tol:1);

// Break from bottom to top (prevents leaves floating)
repeat(py: base_y..(base_y+10)) {
  if (block_is(base_x, py, base_z, "oak_log")) {
    break(base_x, py, base_z);
    wait(200);  // Let blocks settle
  }
}

// Collect drops
pickup_blocks(16);
```

### Calling Custom Functions

Once created, call functions using the same syntax as built-in commands:

```c
// Call with named arguments
fell_oak(height:12, cleanup:true);

// Can be nested in loops
repeat(tree_num: 0..4) {
  goto(100 + tree_num * 10, 64, 200, tol:1);
  fell_oak(height:15, cleanup:true);
}
```

### Testing Strategy: Iterative Refinement

Use a systematic test-driven approach to develop robust functions:

#### 1. Define the Task

Be specific about inputs, expected outcomes, and success criteria:

```
Task: Fell an oak tree safely
- Input: Tree base coordinates, expected height
- Expected: All logs removed, saplings/sticks collected
- Success: No floating logs, inventory has drops
```

#### 2. Execute the Function

Run your custom function with test data:

```c
// Test script: test_fell_oak.cs
log("=== EXECUTING FUNCTION ===");
fell_oak(base_x:102, base_y:64, base_z:108, height:12);
log("=== DONE ===");
```

#### 3. Review Block Changes and Movement

After execution, use the `craftscript_trace` MCP tool to see all block modifications and movement:

```typescript
// Bot queries its own trace data (block changes + movement)
const trace = await craftscript_trace({ job_id: "cs_xyz123" });

// Returns:
{
  job_id: "cs_xyz123",
  total_changes: 47,
  changes: [
    { action: "destroyed", x: 102, y: 64, z: 108, block_id: "oak_log", command: "break", timestamp: 1234567890 },
    { action: "destroyed", x: 102, y: 65, z: 108, block_id: "oak_log", command: "break", timestamp: 1234567891 },
    { action: "placed", x: 100, y: 64, z: 105, block_id: "oak_sapling", command: "plant", timestamp: 1234567892 },
    // ... all blocks destroyed/placed
  ]
}
```

The system automatically tracks:
- **Every block placed or destroyed** - Complete audit trail
- **Exact coordinates and block type** - Know exactly what changed where
- **Which CraftScript command caused the change** - Full traceability
- **Timestamp for each modification** - Chronological ordering
- **Works even if the script fails mid-execution** - Failure-resilient

**3D Visualization**: The dashboard displays a 3D voxel view with:
- Green glowing blocks for placed blocks
- Red glowing blocks for destroyed blocks
- Yellow movement path showing bot navigation
- Interactive orbit controls for inspection

**Movement Tracking**: The `craftscript_logs` tool includes movement traces from `goto` commands:
- Starting position (`from`)
- Target position (`to`)
- Actual arrival position (`arrived`)
- Waypoint names if used

#### 4. Compare and Iterate

If the test fails:
1. Review the CraftScript logs (click "Show Logs" in dashboard)
2. Identify the failure point (wrong coordinates? timing issue? missing check?)
3. Update the function using `edit_craftscript_function`
4. Re-run the test

Example iteration:

```c
// Version 1: Missed logs due to wait time
// ... fails because blocks fall too slowly

// Version 2: Added wait after each break
// ... works but slow

// Version 3: Optimized with batch waits
repeat(py: base_y..(base_y+height)) {
  if (block_is(base_x, py, base_z, "oak_log")) {
    break(base_x, py, base_z);
  }
}
wait(2000);  // Single wait after all breaks
pickup_blocks(16);
```

### Advanced Testing Example

```c
// Comprehensive test for plant_sapling_grid function

log("=== TEST: plant_sapling_grid ===");

// 1. Define test area
let test_ox = 113;
let test_oy = 64;
let test_oz = 114;

// 2. Pre-check: Verify ground is dirt
log("Pre-check: Ground material");
let prep_fail = false;
repeat(ix: 0..2) {
  repeat(iz: 0..2) {
    let px = test_ox + ix * 6;
    let pz = test_oz + iz * 6;
    if (!block_is(px, test_oy - 1, pz, "dirt") &&
        !block_is(px, test_oy - 1, pz, "grass_block")) {
      log("PREP_FAIL: Not dirt at", px, pz);
      prep_fail = true;
    }
  }
}

if (prep_fail) {
  log("ABORT: Test area not prepared");
  assert(false, "test_area_invalid");
}

// 3. Execute function
log("Executing: plant_sapling_grid");
plant_sapling_grid(origin_x:test_ox, origin_y:test_oy, origin_z:test_oz,
                    rows:3, cols:3, spacing:6);

// 4. Verify results
log("Post-check: Sapling placement");
let planted = 0;
let expected = 9;
repeat(ix: 0..2) {
  repeat(iz: 0..2) {
    let px = test_ox + ix * 6;
    let pz = test_oz + iz * 6;
    if (block_is(px, test_oy, pz, "oak_sapling")) {
      planted = planted + 1;
      log("PASS: Sapling at", px, pz);
    } else {
      log("FAIL: Missing sapling at", px, pz);
    }
  }
}

// 5. Report results
if (planted == expected) {
  log("SUCCESS:", planted, "/", expected, "saplings planted");
} else {
  log("FAIL:", planted, "/", expected, "saplings planted");
}
```

### Best Practices

1. **Start Simple**: Create minimal working version first
2. **Test Incrementally**: Test each new capability as you add it
3. **Use Logging**: Add `log()` calls liberally to trace execution
4. **Check Predicates**: Use `block_is()`, `has_item()`, `can_stand()` for validation
5. **Handle Edge Cases**: Check for obstacles, missing items, wrong terrain
6. **Version Deliberately**: Each version should fix specific issues
7. **Document Changes**: Use descriptive change_summary when editing

### Error Handling in Functions

Functions fail immediately on errors, but you can design them to be more robust:

```c
// Defensive function: check preconditions
if (!has_item("oak_sapling")) {
  log("ERROR: No oak_sapling in inventory");
  assert(false, "missing_item");
}

if (!block_is(px, py-1, pz, "dirt") && !block_is(px, py-1, pz, "grass_block")) {
  log("ERROR: Cannot plant on", px, py-1, pz);
  assert(false, "invalid_ground");
}

// Now safe to proceed
plant("oak_sapling", px, py, pz);
```

### Recursive Functions (Limited Depth)

Functions can call themselves or other custom functions, up to depth 10:

```c
// Function: clear_column
// Recursively clears blocks above until air found
if (is_air(x, y, z)) {
  log("Column clear at y=", y);
} else {
  break(x, y, z);
  wait(100);
  clear_column(x:x, y:y+1, z:z);  // Recursive call
}
```

**Note**: Excessive recursion (>10 depth) returns error `"Maximum function call depth exceeded"`.

---

## 14) Validation & limits

* Unknown commands → compile error.
* Named arguments checked per command.
* Loops & recursion limited by config.
* Registry IDs must be canonical strings.
* Executor enforces all safety invariants.

---

## ✅ TL;DR

CraftScript is a **minimal lowercase scripting language** for Minecraft agents:

```c
if (safe_step_up(f1)) {
  dig(f1+u2);
  move(f1^);
}
```

It uses **Minecraft’s real IDs**, **relative coordinates**, and a strict executor, producing **clear structured results** for humans and LLMs alike.

---

# Runtime Introspection & Navigation API (vox + nav)

Below is a tight set of **world-understanding methods + one navigation wrapper** that map directly to Mineflayer and return simple JSON with real Minecraft IDs and absolute world coordinates.

---

IDs must be **registry strings** like `"minecraft:oak_log"`, faces `"up|down|north|south|east|west"`.

---

# The 6 methods (minimal, practical)

## 1) `get_vox(radius=2, include_air=false, grep?: string[])`

Local 3D snapshot (5×5×5 default) as a list of voxels with world coordinates and an optional `matches` array when `grep` is provided.

**Response payload**

```json
{
  "window": { "radius": 2, "shape": [5,5,5], "origin": { "x": 120, "y": 64, "z": -80 } },
  "voxels": [
    { "x": 120, "y": 64, "z": -79, "id": "minecraft:dirt" },
    { "x": 120, "y": 65, "z": -79, "id": "minecraft:dirt" },
    { "x": 120, "y": 66, "z": -79, "id": "minecraft:stone" }
  ],
  "predicates": { "HAZARDS": ["gravel_overhead"] },
  "grep": ["oak_log"],
  "matches": [ { "x": 121, "y": 64, "z": -81, "id": "minecraft:oak_log" } ]
}
```

---

## 2) `affordances({ x, y, z })`

What’s safely doable **at/into** a world position (standability, step up/down, place faces, tool hint).

```json
{
  "position": { "x": 121, "y": 64, "z": -80 },
  "can_stand": true,
  "safe_step_up": false,
  "safe_step_down": true,
  "placeable_faces": ["up","north"],
  "tools": { "break_best": "minecraft:iron_pickaxe", "place_requires_support": true }
}
```

---

## 3) `nearest(query)`

Find nearest **block** or **entity** with reachability hint.

**Request**

```json
{ "block_id":"minecraft:oak_log", "radius":48, "reachable":true }
```

**Response**

```json
{
  "matches": [
    { "world":[120,65,-80], "dist":6.0, "reachable":true },
    { "world":[125,65,-84], "dist":9.2, "reachable":false }
  ]
}
```

*(Support `entity_id:"minecraft:cow"` the same way.)*

---

## 4) `block_info(target)`

On-demand block properties for reasoning (don’t dump catalogs).

**Request** (by id **or** world coordinates)

```json
{ "id":"minecraft:gravel" }  // or { "x":120, "y":66, "z":-80 }
```

**Response**

```json
{
  "id": "minecraft:gravel",
  "state": null,
  "props": {
    "category": "gravity",
    "preferred_tool": "minecraft:iron_shovel",
    "falls": true,
    "liquid": false,
    "place_requires_support": false,
    "hardness": 0.6,
    "light_emission": 0,
    "drops": ["minecraft:gravel"]
  }
}
```

---

## 5) `get_topography(radius=6)`

Bird’s-eye **heightmap & slope** around the agent (world x/z keys).

```json
{
  "grid": { "size": [13,13], "origin": { "x": 120, "z": -80 } },
  "heightmap": { "120,-80": 0, "121,-80": 1, "122,-80": 2, "119,-81": -1 },
  "slope": { "121,-80": "gentle_up", "118,-81": "down" },
  "summary": { "min": -3, "max": 4, "flat_cells": 89 }
}
```

---

## 6) `nav(action, ...)` — **single wrapper for mineflayer-pathfinder**

One method for **start / status / cancel**, so we don’t add more endpoints.

### a) Start

**Request**

```json
{
  "action": "start",
  "target": { "type":"WORLD", "x":140, "y":64, "z":92 },
  "tol": 1,
  "timeout_ms": 8000,
  "policy": { "allow_dig": false, "max_drop": 1, "max_step": 1 }
}
```

**Response**

```json
{ "nav_id": "nav_7q2", "state": "planning" }
```

**How to wire to mineflayer-pathfinder**

* Choose Goal type:

  * world: `new GoalNear(x,y,z,tol)` or `GoalBlock/GoalXZ` as appropriate
  * selector: convert to world then same
* Configure `Movements` from `policy` (maxDrop, maxStep, blocksToAvoid, etc.)
* Call `bot.pathfinder.setMovements(movements)`, then `setGoal(goal, /*dynamic=*/true?)`
* Subscribe & translate events to WS/return values:

  * `path_update` → progress (nodes, distance, reached)
  * `goal_reached` → `state:"arrived"`
  * `goal_reset` / `goal_aborted` → `state:"canceled"`
  * timeouts you enforce → `state:"failed", reason:"timeout"`

### b) Status

**Request**

```json
{ "action": "status", "nav_id": "nav_7q2" }
```

**Response**

```json
{
  "nav_id": "nav_7q2",
  "state": "moving",                   // planning|moving|arrived|stuck|failed|canceled
  "distance_remaining": 8.4,
  "nodes_expanded": 152,
  "replan_count": 2,
  "eta_seconds": 12
}
```

### c) Cancel

**Request**

```json
{ "action": "cancel", "nav_id": "nav_7q2" }
```

**Response**

```json
{ "nav_id": "nav_7q2", "state": "canceled" }
```

**Failure → Planner feedback (examples)**

* `UNREACHABLE` (pathfinder returns no path)
* `BLOCKED` (dynamic obstacle detected, replan exceeded)
* `TIMEOUT` (exceeded timeout_ms)
* `HAZARD` (your hazard_envelope says lava/void ahead; you abort)

> The planner can react by `get_vox`, `affordances`, or enqueueing a micro-clear job.

---

## Why this set?

* It gives the planner **just enough** to plan safely: local vox, affordances, nearest targets, block facts, terrain feel, and a clean **nav wrapper** that reuses your pathfinder.
* All payloads use **Minecraft’s own IDs/names**, so there’s **no mapping layer** to go wrong.
* The nav wrapper keeps the interface count to **one** while still offering start/status/cancel.

---

## Implementation notes (repo integration)

- Parser: planned with Peggy.js; the grammar above can be dropped into a `peggy` build to emit an AST with lowercase command names.
- Executor: enforce safety invariants and map commands to Mineflayer/MCP calls as listed in section 10.
- Env methods: expose the 5 vox methods + `nav` wrapper via your MCP server so the planner and agent share a single interface.
- IDs/faces: always pass through canonical registry strings unchanged (`"minecraft:..."`, `"up|north|..."`).
