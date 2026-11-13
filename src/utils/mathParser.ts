import * as math from 'mathjs';

export interface CompiledFunction {
  evaluate: (x: number) => number;
  expression: string;
}

export function normalizeDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) - (digit >= '۰' ? 0x06f0 : 0x0660)))
    .replace(/٫/g, '.').replace(/−/g, '-');
}

/**
 * Normalizes user math expression to standard mathjs format
 */
export function normalizeMathExpression(expr: string): string {
  let cleaned = normalizeDigits(expr).trim();
  if (!cleaned) return '';

  // Replace unicode symbols
  cleaned = cleaned.replace(/π/g, 'pi');
  cleaned = cleaned.replace(/×/g, '*');
  cleaned = cleaned.replace(/÷/g, '/');
  cleaned = cleaned.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/g, (_, exponent: string) =>
    '^(' + Array.from(exponent, (character) => character === '⁻' ? '-' : String('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(character))).join('') + ')');
  cleaned = cleaned.replace(/√\s*\(/g, 'sqrt(').replace(/√\s*(x|\d+(?:\.\d+)?)/g, 'sqrt($1)');
  cleaned = cleaned.replace(/\|([^|]+)\|/g, 'abs($1)').replace(/·/g, '*');
  const sides = cleaned.split('=');
  if (sides.length === 2 && sides.every((side) => side.trim())) {
    cleaned = `(${sides[0]})-(${sides[1]})`;
  }
  
  // Replace ln( with log( (in mathjs log is natural logarithm ln)
  // And replace log10( with log10(
  cleaned = cleaned.replace(/\bln\s*\(/g, 'log(');

  return cleaned;
}

const functions = new Set([
  'abs', 'sqrt', 'cbrt', 'nthRoot', 'pow', 'exp', 'log', 'log10', 'log2',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
  'sec', 'csc', 'cot', 'floor', 'ceil', 'round', 'sign', 'min', 'max',
]);

function parseExpression(normalized: string) {
  const parsed = math.parse(normalized);
  parsed.traverse((node, path, parent) => {
    if (node.type === 'FunctionNode' && (node as math.FunctionNode).fn.type === 'SymbolNode' && functions.has((node as math.FunctionNode).fn.name)) return;
    if (node.type === 'SymbolNode') {
      const { name } = node as math.SymbolNode;
      if (['x', 'pi', 'e'].includes(name) || (parent?.type === 'FunctionNode' && path === 'fn' && functions.has(name))) return;
      throw new Error(`Undefined symbol ${name}`);
    }
    if (node.type === 'ConstantNode' && typeof (node as math.ConstantNode).value === 'number') return;
    if (node.type === 'OperatorNode' && ['+', '-', '*', '/', '^', '%'].includes((node as math.OperatorNode).op)) return;
    if (node.type === 'ParenthesisNode') return;
    throw new Error('از عدد، متغیر x و توابع ریاضی پشتیبانی‌شده استفاده کنید.');
  });
  return parsed;
}

export function expressionMathML(value: string) {
  const parsed = parseExpression(normalizeMathExpression(value));
  return renderNode(parsed);
}

function renderNode(node: math.MathNode): string {
  if (node.type === 'ConstantNode') return `<mn>${(node as math.ConstantNode).value}</mn>`;
  if (node.type === 'SymbolNode') {
    const { name } = node as math.SymbolNode;
    return `<mi>${name === 'pi' ? 'π' : name}</mi>`;
  }
  if (node.type === 'ParenthesisNode') {
    return `<mrow><mo>(</mo>${renderNode((node as math.ParenthesisNode).content)}<mo>)</mo></mrow>`;
  }
  if (node.type === 'FunctionNode') {
    const { fn: { name }, args } = node as math.FunctionNode;
    if (name === 'sqrt' && args.length === 1) return `<msqrt>${renderNode(args[0])}</msqrt>`;
    return `<mrow><mi>${name}</mi><mo>(</mo>${args.map(renderNode).join('<mo>,</mo>')}<mo>)</mo></mrow>`;
  }
  const { op, args } = node as math.OperatorNode;
  const [left, right] = args.map(renderNode);
  if (op === '/') return `<mfrac>${left}${right}</mfrac>`;
  if (op === '^') return `<msup>${left}${right}</msup>`;
  const symbol = op === '*' ? '·' : op === '-' ? '−' : op;
  return right ? `<mrow>${left}<mo>${symbol}</mo>${right}</mrow>` : `<mrow><mo>${symbol}</mo>${left}</mrow>`;
}

/**
 * Compiles a mathematical expression into a safe executable function
 */
export function compileExpression(expr: string): { fn: ((x: number) => number) | null; error: string | null } {
  const normalized = normalizeMathExpression(expr);
  if (!normalized) {
    return { fn: null, error: 'لطفاً عبارت تابع را وارد کنید.' };
  }

  try {
    const compiled = parseExpression(normalized).compile();

    const safeFn = (x: number): number => {
      try {
        const val = compiled.evaluate({ x, pi: Math.PI, e: Math.E });
        if (typeof val === 'number') {
          if (Number.isNaN(val) || !Number.isFinite(val)) {
            throw new Error(`مقدار تابع در x = ${x} تعریف نشده یا بی‌نهایت است.`);
          }
          return val;
        } else if (val && typeof val === 'object' && 'im' in val) {
          if (Math.abs(val.im) < 1e-12 && Number.isFinite(val.re)) {
            return val.re;
          }
          throw new Error(`مقدار مختلط در دامنه اعداد حقیقی تولید شد (${val.toString()}).`);
        }
        throw new Error('خروجی تابع باید یک عدد حقیقی باشد.');
      } catch (err: any) {
        throw new Error(`خطا در ارزیابی تابع در x = ${x}: ${err.message}`);
      }
    };

    return { fn: safeFn, error: null };
  } catch (err: any) {
    return {
      fn: null,
      error: translateMathError(err.message || 'عبارت ریاضی نامعتبر است.')
    };
  }
}

/**
 * Derives the expression symbolically with mathjs or returns null if not possible
 */
export function getSymbolicDerivative(expr: string): { derivativeExpr: string | null; error: string | null } {
  const normalized = normalizeMathExpression(expr);
  if (!normalized) return { derivativeExpr: null, error: null };

  try {
    const parsed = parseExpression(normalized);
    const derived = math.derivative(parsed, 'x');
    return { derivativeExpr: derived.toString(), error: null };
  } catch (err: any) {
    return { derivativeExpr: null, error: err.message };
  }
}

/**
 * Computes numerical derivative using central finite difference:
 * f'(x) ≈ (f(x + h) - f(x - h)) / (2h)
 */
export function numericalDerivative(fn: (x: number) => number, x: number): number {
  const h = Math.max(1e-6, Math.abs(x) * 1e-7);
  const fPlus = fn(x + h);
  const fMinus = fn(x - h);
  return (fPlus - fMinus) / (2 * h);
}

/**
 * Translates common mathjs error messages into Persian
 */
function translateMathError(msg: string): string {
  if (msg.includes('Parenthesis ) expected') || msg.includes('Unexpected end of expression')) {
    return 'پرانتزها بسته نشده‌اند یا ساختار عبارت ناقص است.';
  }
  if (msg.includes('Unexpected type of argument') || msg.includes('Undefined symbol')) {
    const match = msg.match(/Undefined symbol (\w+)/);
    if (match) {
      return `نماد ناشناخته «${match[1]}». فقط از متغیر x و توابع مجاز استفاده کنید.`;
    }
    return 'متغیر یا عملگر نامعتبر در عبارت یافت شد.';
  }
  if (msg.includes('Value expected')) {
    return 'عملگر بدون مقدار یا عدد پس از آن وارد شده است.';
  }
  return `خطای نحوی: ${msg}`;
}
