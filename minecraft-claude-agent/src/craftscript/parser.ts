import peggyModule from 'peggy';
// NOTE: Import the TypeScript grammar directly to avoid stale dist/grammar.js
import { CRAFTSCRIPT_GRAMMAR } from './grammar.ts';
import type { Program } from './types.js';

// Support both ESM default-exported function and CommonJS object with generate()
const peggyGenerate: (source: string, opts?: any) => any =
  (peggyModule as any).generate ? (peggyModule as any).generate : (peggyModule as any);

let _parser: any | null = null;

function getParser(): any {
  if (_parser) return _parser;
  _parser = peggyGenerate(CRAFTSCRIPT_GRAMMAR, {
    output: 'parser',
  });
  return _parser;
}

export function parse(script: string): Program {
  const parser = getParser();
  return parser.parse(script) as Program;
}
