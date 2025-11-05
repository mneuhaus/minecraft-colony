export const CRAFTSCRIPT_GRAMMAR = String.raw`
{
  function node(type, props){ return Object.assign({type,loc:location()}, props||{}); }
}
Start = _ body:StatementList _ { return node("Program",{body}); }
StatementList = s:Statement tail:(_ Statement)* { return s ? [s,...tail.map(t=>t[1])] : []; }

Statement
  = MacroDecl
  / IfStmt
  / RepeatStmt
  / WhileStmt
  / AssertStmt ";"
  / CommandStmt ";"
  / ";" {return node("Empty");}

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
AssertStmt = "assert" _ "(" _ e:Expr _ msg:("," _ m:StringLiteral)? _ ")" {
  return node("AssertStmt", { test: e, message: msg ? msg[2] : null });
}
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
  / PredicateCall
  / SelectorWithSuffix
  / WorldCoord
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

WorldCoord = "world" _ "(" _ x:SignedInt _ "," _ y:SignedInt _ "," _ z:SignedInt _ ")" { return node("World",{x,y,z}); }
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

Identifier = !Keyword id:([a-z_][a-z0-9_]*) { return id.join(""); }
Keyword = "macro" / "if" / "else" / "repeat" / "while" / "assert" / "true" / "false"

_ = (WhiteSpace / Comment)* ; __ = (WhiteSpace / Comment)+
WhiteSpace = [ \t\r\n]+
Comment = "//" [^\n]* "\n"? / "/*" (!"*/" .)* "*/"
`;
