export const CRAFTSCRIPT_GRAMMAR = String.raw`
{
  function node(type, props){ return Object.assign({type,loc:location()}, props||{}); }
}
Start = _ body:StatementList _ { return node("Program",{body}); }
StatementList = head:Statement? tail:(_ Statement)* {
  if (!head) return [];
  return [head, ...tail.map(t => t[1])];
}

Statement
  = MacroDecl
  / IfStmt
  / RepeatStmt
  / WhileStmt
  / LetStmt
  / AssignStmt
  / s:AssertStmt ";" { return s; }
  / s:CommandStmt ";" { return s; }
  / ";" { return node("Empty"); }

MacroDecl = "macro" __ name:Identifier _ "(" _ params:ParamList? _ ")" _ blk:Block
  { return node("MacroDecl",{name,params:params||[],body:blk}); }

ParamList = head:Param tail:(_ "," _ Param)* { return [head,...tail.map(t=>t[3])]; }
Param = t:Type __ id:Identifier { return node("Param",{name:id,paramType:t}); }
Type = "int" {return "int";} / "bool" {return "bool";} / "string" {return "string";}

Block = "{" _ body:StatementList? _ "}" { return node("Block",{body:body||[]}); }

IfStmt = "if" _ "(" _ cond:Expr _ ")" _ t:Block _ elsePart:("else" _ alt:Block)?
  {
    const alternate = elsePart ? elsePart[2] : null;
    return node("IfStmt",{test:cond,consequent:t,alternate});
  }
// repeat forms:
//  - repeat(N) { ... }
//  - repeat(i: N) { ... }            // i = 0..N-1
//  - repeat(i: A .. B [: S]) { ... } // i from A to B inclusive, optional step S
RepeatStmt = "repeat" _ "(" _
  (
    id:Identifier _ ":" _ s:Expr _ ".." _ e:Expr step:( _ ":" _ Expr )? _ ")" _ b:Block
      { return node("RepeatStmt",{varName:id, start:s, end:e, step: step? step[3]: null, body:b}); }
  /
    id2:Identifier _ ":" _ lim:Expr _ ")" _ b2:Block
      { return node("RepeatStmt",{varName:id2, count:lim, body:b2}); }
  /
    n:Expr _ ")" _ b3:Block
      { return node("RepeatStmt",{count:n, body:b3}); }
  )

WhileStmt = "while" _ "(" _ c:Expr _ ")" _ b:Block { return node("WhileStmt",{test:c,body:b}); }
AssertStmt = "assert" _ "(" _ expr:Expr _ msg:("," _ m:StringLiteral)? _ ")" {
  return node("AssertStmt", { test: expr, message: msg ? msg[2] : null });
}
CommandStmt = name:Identifier _ "(" _ args:ArgList? _ ")" { return node("Command",{name,args:args||[]}); }

// Variables
LetStmt = "let" __ name:Identifier _ "=" _ value:Expr _ ";" { return node("LetStmt",{name,value}); }
AssignStmt = name:Identifier _ "=" _ value:Expr _ ";" { return node("AssignStmt",{name,value}); }

ArgList = head:Arg tail:(_ "," _ Arg)* { return [head,...tail.map(t=>t[3])]; }
Arg = NamedArg / Expr
NamedArg = key:Identifier _ ":" _ val:Expr { return node("NamedArg",{key,value:val}); }

Expr = OrExpr
OrExpr = left:AndExpr tail:(_ "||" _ AndExpr)* { return tail.reduce((a,t)=>node("LogicalExpr",{op:"||",left:a,right:t[3]}),left); }
AndExpr = left:AddExpr tail:(_ "&&" _ AddExpr)* { return tail.reduce((a,t)=>node("LogicalExpr",{op:"&&",left:a,right:t[3]}),left); }
AddExpr = left:MulExpr tail:(_ op:[+-] _ MulExpr)* { return tail.reduce((a,t)=>node("BinaryExpr",{op:t[1],left:a,right:t[3]}),left); }
MulExpr = left:Unary tail:(_ op:[*/] _ Unary)* { return tail.reduce((a,t)=>node("BinaryExpr",{op:t[1],left:a,right:t[3]}),left); }
Unary = "!" _ e:Unary { return node("UnaryExpr",{op:"!",arg:e}); } / Primary

Primary
  = "(" _ e:Expr _ ")" {return e;}
  / PredicateCall
  / SelectorWithSuffix
  / Waypoint
  / BlockQuery
  / NumberLiteral
  / StringLiteral
  / BooleanLiteral
  / IdentifierExpr

PredicateCall = name:Identifier _ "(" _ args:ArgList? _ ")" { return node("PredicateCall",{name,args:args||[]}); }
IdentifierExpr = id:Identifier { return node("Identifier",{name:id}); }

// Selectors support optional ^ / _ suffix on the entire selector
SelectorWithSuffix = sel:Selector suf:("^" / "_")? {
  if (!suf) return sel;
  const add = node("SelTerm",{axis: suf === "^" ? "u" : "d", n: 1});
  return node("Selector", { terms: sel.terms.concat([add]) });
}

Selector = head:SelectorTerm tail:(_ "+" _ SelectorTerm)* { return node("Selector",{terms:[head,...tail.map(t=>t[3])]}); }
SelectorTerm = axis:[FfBbRrLlUuDd] n:SignedInt? { return node("SelTerm",{axis:text().charAt(0).toLowerCase(),n:n!==null?n:1}); }

Waypoint = "waypoint" _ "(" _ n:StringLiteral _ ")" { return node("Waypoint",{name:n}); }
BlockQuery = "block" _ "(" _ kv:NamedArg tail:(_ "," _ NamedArg)* _ ")" {
  const pairs = [kv].concat((tail||[]).map(t=>t[3]));
  const o = {};
  for (const p of pairs) o[p.key] = p.value;
  return node("BlockQuery", { query: o });
}

NumberLiteral = n:SignedInt { return node("Number",{value:n}); }
SignedInt = s:"-"? d:[0-9]+ { return parseInt((s||"")+d.join(""),10); }
StringLiteral = "\"" chars:Char* "\"" { return node("String",{value:chars.join("")}); }
Char = "\\\"" {return "\""} / "\\n" {return "\n"} / "\\t" {return "\t"} / !("\"") . {return text();}
BooleanLiteral = "true" {return node("Boolean",{value:true});} / "false" {return node("Boolean",{value:false});}

Identifier = !Keyword id:([a-z_][a-z0-9_]*) { return id.flat().join(""); }
Keyword = "macro" / "if" / "else" / "repeat" / "while" / "assert" / "let" / "true" / "false"

_ = (WhiteSpace / Comment)* ; __ = (WhiteSpace / Comment)+
WhiteSpace = [ \t\r\n]+
Comment = "//" [^\n]* "\n"? / "/*" (!"*/" .)* "*/"
`;
