export type Location = { line: number; column: number };

export interface BaseNode {
  type: string;
  loc?: { start?: Location; end?: Location } | any;
}

export interface Program extends BaseNode {
  type: 'Program';
  body: Statement[];
}

export type Statement =
  | MacroDecl
  | IfStmt
  | RepeatStmt
  | WhileStmt
  | AssertStmt
  | LetStmt
  | AssignStmt
  | CommandStmt
  | Block
  | EmptyStmt;

export interface EmptyStmt extends BaseNode {
  type: 'Empty';
}

export interface MacroDecl extends BaseNode {
  type: 'MacroDecl';
  name: string;
  params: { name: string; paramType: 'int' | 'bool' | 'string' }[];
  body: Block;
}

export interface Block extends BaseNode {
  type: 'Block';
  body: Statement[];
}

export interface IfStmt extends BaseNode {
  type: 'IfStmt';
  test: Expr;
  consequent: Block;
  alternate: Block | null;
}

export interface RepeatStmt extends BaseNode {
  type: 'RepeatStmt';
  count?: Expr; // Legacy: repeat(N)
  varName?: string; // New: repeat(i: N) or repeat(i: A..B[:S])
  start?: Expr;
  end?: Expr;
  step?: Expr;
  body: Block;
}

export interface WhileStmt extends BaseNode {
  type: 'WhileStmt';
  test: Expr;
  body: Block;
}

export interface AssertStmt extends BaseNode {
  type: 'AssertStmt';
  test: Expr;
  message: StringLiteral | null;
}

export interface LetStmt extends BaseNode {
  type: 'LetStmt';
  name: string;
  value: Expr;
}

export interface AssignStmt extends BaseNode {
  type: 'AssignStmt';
  name: string;
  value: Expr;
}

export interface CommandStmt extends BaseNode {
  type: 'Command';
  name: string;
  args: Arg[];
}

export type Arg = NamedArg | Expr;

export interface NamedArg extends BaseNode {
  type: 'NamedArg';
  key: string;
  value: Expr;
}

// Expressions
export type Expr =
  | LogicalExpr
  | UnaryExpr
  | BinaryExpr
  | PredicateCall
  | Selector
  | World
  | Waypoint
  | BlockQuery
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | IdentifierExpr;

export interface BinaryExpr extends BaseNode {
  type: 'BinaryExpr';
  op: '+' | '-' | '*' | '/';
  left: Expr;
  right: Expr;
}

export interface LogicalExpr extends BaseNode {
  type: 'LogicalExpr';
  op: '&&' | '||';
  left: Expr;
  right: Expr;
}

export interface UnaryExpr extends BaseNode {
  type: 'UnaryExpr';
  op: '!';
  arg: Expr;
}

export interface PredicateCall extends BaseNode {
  type: 'PredicateCall';
  name: string;
  args: Arg[];
}

export interface Selector extends BaseNode {
  type: 'Selector';
  terms: SelTerm[];
}

export interface SelTerm extends BaseNode {
  type: 'SelTerm';
  axis: 'f' | 'b' | 'r' | 'l' | 'u' | 'd';
  n: number;
}

export interface World extends BaseNode {
  type: 'World';
  x: number;
  y: number;
  z: number;
}

export interface Waypoint extends BaseNode {
  type: 'Waypoint';
  name: StringLiteral;
}

export interface BlockQuery extends BaseNode {
  type: 'BlockQuery';
  query: Record<string, Expr>;
}

export interface NumberLiteral extends BaseNode {
  type: 'Number';
  value: number;
}

export interface StringLiteral extends BaseNode {
  type: 'String';
  value: string;
}

export interface BooleanLiteral extends BaseNode {
  type: 'Boolean';
  value: boolean;
}

export interface IdentifierExpr extends BaseNode {
  type: 'Identifier';
  name: string;
}

export type CraftscriptResult =
  | { ok: true; op: string; ms: number; notes?: any }
  | {
      ok: false;
      error: string;
      message: string;
      loc?: Location;
      op_index: number;
      op?: string; // command that failed (e.g., "break", "deposit")
      notes?: any; // structured context about the failure
      at?: any;
      ts: number;
    };

export interface ExecutorOptions {
  opLimit?: number;
  defaultScanRadius?: number;
  autoScanBeforeOps?: boolean;
  // Optional per-step callback for streaming results to the dashboard
  onStep?: (result: CraftscriptResult) => void;
  // Verbose trace callback for internal events (ifs, loops, vars, predicates, command start)
  onTrace?: (trace: any) => void;
  // Database connection for custom functions and block tracking
  db?: any;
  // Bot ID for retrieving custom functions and logging block changes
  botId?: number;
  // Job ID for tracking block changes
  jobId?: string;
}

// Custom function definition
export interface CustomFunction {
  id: number;
  bot_id: number;
  name: string;
  description: string | null;
  args: Array<{ name: string; type: string; optional?: boolean; default?: any }>;
  body: string; // CraftScript source code
  current_version: number;
  created_at: number;
  updated_at: number;
  created_by: string | null;
}
