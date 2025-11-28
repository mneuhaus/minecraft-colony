export interface CraftScriptFunctionArg {
  name: string;
  type: 'int' | 'bool' | 'string';
  optional?: boolean;
  default?: any;
}

export interface CraftScriptFunction {
  id: number;
  name: string;
  description: string | null;
  args: CraftScriptFunctionArg[];
  body: string;
  current_version: number;
}

/**
 * Load all custom functions for a specific bot from the database
 */
export function loadBotFunctions(botId: number, db: any): CraftScriptFunction[] {
  try {
    const rows = db.prepare(`
      SELECT id, name, description, args, body, current_version
      FROM craftscript_functions
      WHERE bot_id = ?
      ORDER BY name ASC
    `).all(botId) as any[];

    return rows.map(row => ({
      ...row,
      args: JSON.parse(row.args)
    }));
  } catch (error) {
    console.error('Failed to load bot functions:', error);
    return [];
  }
}

/**
 * Validate and coerce function arguments to match expected types
 */
export function validateAndCoerceArgs(
  argDefs: CraftScriptFunctionArg[],
  values: any[]
): any[] {
  const result: any[] = [];

  for (let i = 0; i < argDefs.length; i++) {
    const argDef = argDefs[i];
    const value = values[i];

    // Handle optional args with defaults
    if (value === undefined) {
      if (argDef.optional) {
        result.push(argDef.default);
        continue;
      }
      throw new Error(`Missing required argument: ${argDef.name}`);
    }

    // Type coercion and validation
    switch (argDef.type) {
      case 'int':
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Argument '${argDef.name}' must be a number, got: ${typeof value}`);
        }
        result.push(Math.floor(num));
        break;

      case 'bool':
        result.push(Boolean(value));
        break;

      case 'string':
        result.push(String(value));
        break;

      default:
        throw new Error(`Unknown argument type: ${argDef.type}`);
    }
  }

  return result;
}

/**
 * Format function arguments for display in console logs
 */
export function formatFunctionArgs(argDefs: CraftScriptFunctionArg[], values: any[]): string {
  return argDefs.map((argDef, i) => {
    const value = values[i];
    const displayValue = typeof value === 'string' ? `"${value}"` : String(value);
    return `${argDef.name}=${displayValue}`;
  }).join(', ');
}
