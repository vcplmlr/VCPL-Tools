import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Delete,
  Equal,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Keyboard,
  Printer,
  RotateCcw,
} from 'lucide-react';
import {
  downloadBomCsv,
  downloadExcelWorkbook,
  downloadJsonFile,
  downloadWordDocument,
  exportStructuredReportPdf,
  printHtmlDocument,
} from '../../utils/printReport';

type AngleUnit = 'DEG' | 'RAD' | 'GRAD';
type DisplayFormat = 'STD' | 'SCI' | 'ENG';

interface TapeEntry {
  expr: string;
  result: string;
  angle: AngleUnit;
  timestamp: string;
}

function factorial(n: number): number {
  if (!Number.isFinite(n) || n < 0 || n > 170 || !Number.isInteger(n)) {
    throw new Error('Factorial requires integer 0..170');
  }
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

function nCr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) {
    throw new Error('Invalid nCr');
  }
  if (r === 0 || r === n) return 1;
  const k = Math.min(r, n - r);
  let res = 1;
  for (let i = 1; i <= k; i++) {
    res = (res * (n - k + i)) / i;
  }
  return Math.round(res);
}

function nPr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) {
    throw new Error('Invalid nPr');
  }
  let res = 1;
  for (let i = 0; i < r; i++) res *= n - i;
  return res;
}

/**
 * Safe recursive-descent scientific & engineering expression parser.
 */
function evaluateScientificExpression(
  rawExpr: string,
  angleUnit: AngleUnit,
  ansValue: number
): number {
  const cleaned = rawExpr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√\(/g, 'sqrt(')
    .replace(/√(\d+(?:\.\d+)?)/g, 'sqrt($1)')
    .trim();

  if (!cleaned) return 0;

  type Token =
    | { type: 'num'; value: number }
    | { type: 'id'; value: string }
    | { type: 'op'; value: string }
    | { type: 'lparen' }
    | { type: 'rparen' }
    | { type: 'comma' };

  const tokens: Token[] = [];
  let i = 0;

  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      while (i < cleaned.length && /[0-9.]/.test(cleaned[i])) {
        numStr += cleaned[i++];
      }
      // Scientific notation e.g. 1.5e-4 or 2E+6
      if (
        i < cleaned.length &&
        (cleaned[i] === 'e' || cleaned[i] === 'E') &&
        (cleaned[i + 1] === '+' ||
          cleaned[i + 1] === '-' ||
          /[0-9]/.test(cleaned[i + 1] || ''))
      ) {
        numStr += cleaned[i++];
        if (cleaned[i] === '+' || cleaned[i] === '-') {
          numStr += cleaned[i++];
        }
        while (i < cleaned.length && /[0-9]/.test(cleaned[i])) {
          numStr += cleaned[i++];
        }
      }
      const parsed = Number(numStr);
      if (!Number.isFinite(parsed)) throw new Error('Invalid number');
      tokens.push({ type: 'num', value: parsed });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < cleaned.length && /[a-zA-Z0-9_]/.test(cleaned[i])) {
        id += cleaned[i++];
      }
      tokens.push({ type: 'id', value: id.toLowerCase() });
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' });
      i++;
      continue;
    }
    if ('+-*/^%!'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    throw new Error(`Unexpected token: ${ch}`);
  }

  // Insert implicit multiplication (e.g. 2pi, 2(3+4), (2)(3), 3sin(30))
  const expanded: Token[] = [];
  for (let idx = 0; idx < tokens.length; idx++) {
    const cur = tokens[idx];
    const prev = expanded[expanded.length - 1];
    if (prev) {
      const prevEndsValue =
        prev.type === 'num' ||
        prev.type === 'rparen' ||
        (prev.type === 'op' && (prev.value === '!' || prev.value === '%')) ||
        (prev.type === 'id' &&
          ['pi', 'e', 'phi', 'ans'].includes(prev.value));
      const curStartsValue =
        cur.type === 'lparen' || cur.type === 'id' || cur.type === 'num';
      if (prevEndsValue && curStartsValue) {
        expanded.push({ type: 'op', value: '*' });
      }
    }
    expanded.push(cur);
  }

  let pos = 0;
  const peek = () => expanded[pos];
  const consume = () => expanded[pos++];

  const toRad = (v: number) =>
    angleUnit === 'DEG'
      ? (v * Math.PI) / 180
      : angleUnit === 'GRAD'
      ? (v * Math.PI) / 200
      : v;

  const fromRad = (r: number) =>
    angleUnit === 'DEG'
      ? (r * 180) / Math.PI
      : angleUnit === 'GRAD'
      ? (r * 200) / Math.PI
      : r;

  const parseExpression = (): number => parseAddSub();

  const parseAddSub = (): number => {
    let left = parseMulDiv();
    while (
      peek()?.type === 'op' &&
      ((peek() as { type: 'op'; value: string }).value === '+' ||
        (peek() as { type: 'op'; value: string }).value === '-')
    ) {
      const op = (consume() as { type: 'op'; value: string }).value;
      const right = parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  const parseMulDiv = (): number => {
    let left = parseUnary();
    while (
      (peek()?.type === 'op' &&
        ['*', '/'].includes((peek() as { type: 'op'; value: string }).value)) ||
      (peek()?.type === 'id' &&
        (peek() as { type: 'id'; value: string }).value === 'mod')
    ) {
      const tok = consume();
      const op = tok.type === 'id' ? 'mod' : (tok as { type: 'op'; value: string }).value;
      const right = parseUnary();
      if (op === '*') left *= right;
      else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        left /= right;
      } else {
        if (right === 0) throw new Error('Modulo by zero');
        left = left % right;
      }
    }
    return left;
  };

  const parseUnary = (): number => {
    if (
      peek()?.type === 'op' &&
      ['+', '-'].includes((peek() as { type: 'op'; value: string }).value)
    ) {
      const op = (consume() as { type: 'op'; value: string }).value;
      const val = parseUnary();
      return op === '-' ? -val : val;
    }
    return parsePower();
  };

  const parsePower = (): number => {
    const base = parsePostfix();
    if (
      peek()?.type === 'op' &&
      (peek() as { type: 'op'; value: string }).value === '^'
    ) {
      consume();
      const exp = parseUnary();
      return Math.pow(base, exp);
    }
    return base;
  };

  const parsePostfix = (): number => {
    let val = parsePrimary();
    while (
      peek()?.type === 'op' &&
      ['!', '%'].includes((peek() as { type: 'op'; value: string }).value)
    ) {
      const op = (consume() as { type: 'op'; value: string }).value;
      if (op === '!') val = factorial(val);
      else if (op === '%') val = val / 100;
    }
    return val;
  };

  const parsePrimary = (): number => {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of expression');

    if (tok.type === 'num') {
      consume();
      return tok.value;
    }

    if (tok.type === 'lparen') {
      consume();
      const val = parseExpression();
      if (peek()?.type !== 'rparen') throw new Error('Missing closing parenthesis');
      consume();
      return val;
    }

    if (tok.type === 'id') {
      consume();
      const name = tok.value;
      if (name === 'pi') return Math.PI;
      if (name === 'e') return Math.E;
      if (name === 'phi') return (1 + Math.sqrt(5)) / 2;
      if (name === 'ans') return ansValue;

      if (peek()?.type !== 'lparen') throw new Error(`Expected '(' after ${name}`);
      consume();
      const args: number[] = [];
      if (peek()?.type !== 'rparen') {
        args.push(parseExpression());
        while (peek()?.type === 'comma') {
          consume();
          args.push(parseExpression());
        }
      }
      if (peek()?.type !== 'rparen') throw new Error(`Expected ')' after ${name}(...)`);
      consume();

      const a = args[0] ?? 0;
      const b = args[1] ?? 0;
      switch (name) {
        case 'sin':
          return Math.sin(toRad(a));
        case 'cos':
          return Math.cos(toRad(a));
        case 'tan': {
          const rad = toRad(a);
          if (Math.abs(Math.cos(rad)) < 1e-15) throw new Error('Undefined tan');
          return Math.tan(rad);
        }
        case 'asin':
          return fromRad(Math.asin(a));
        case 'acos':
          return fromRad(Math.acos(a));
        case 'atan':
          return fromRad(Math.atan(a));
        case 'sinh':
          return Math.sinh(a);
        case 'cosh':
          return Math.cosh(a);
        case 'tanh':
          return Math.tanh(a);
        case 'sqrt':
          if (a < 0) throw new Error('Negative sqrt');
          return Math.sqrt(a);
        case 'cbrt':
          return Math.cbrt(a);
        case 'abs':
          return Math.abs(a);
        case 'ln':
          if (a <= 0) throw new Error('ln domain error');
          return Math.log(a);
        case 'log':
        case 'log10':
          if (a <= 0) throw new Error('log domain error');
          return Math.log10(a);
        case 'log2':
          if (a <= 0) throw new Error('log2 domain error');
          return Math.log2(a);
        case 'exp':
          return Math.exp(a);
        case 'pow':
          return Math.pow(a, b);
        case 'ncr':
          return nCr(a, b);
        case 'npr':
          return nPr(a, b);
        case 'deg':
          return (a * 180) / Math.PI;
        case 'rad':
          return (a * Math.PI) / 180;
        default:
          throw new Error(`Unknown function: ${name}`);
      }
    }

    throw new Error('Invalid syntax');
  };

  const result = parseExpression();
  if (pos < expanded.length) throw new Error('Trailing tokens');
  if (!Number.isFinite(result)) throw new Error('Result out of range');
  // Clean floating point noise like cos(90 deg) = 6.12e-17
  return Math.abs(result) < 1e-13 ? 0 : result;
}

function formatNumberDisplay(val: number, fmt: DisplayFormat): string {
  if (!Number.isFinite(val)) return 'Error';
  if (fmt === 'SCI') {
    return val.toExponential(6).replace('e+', 'e');
  }
  if (fmt === 'ENG') {
    if (val === 0) return '0';
    const exp3 = Math.floor(Math.log10(Math.abs(val)) / 3) * 3;
    const mantissa = val / Math.pow(10, exp3);
    return `${Number(mantissa.toPrecision(8))}e${exp3 >= 0 ? `+${exp3}` : exp3}`;
  }
  return Number.isInteger(val)
    ? String(val)
    : String(Number(val.toPrecision(12)));
}

const STANDARD_PRESETS: { label: string; expr: string }[] = [
  { label: '1,000 + 18%', expr: '1000 + 18%' },
  { label: '18% GST Reverse', expr: '11800 / 1.18' },
  { label: '15% Discount', expr: '2500 - 15%' },
  { label: '(500 × 12) ÷ 4', expr: '(500 * 12) / 4' },
  { label: '25% of 4,000', expr: '4000 * 25%' },
  { label: 'Average (3 Nos)', expr: '(120 + 85 + 95) / 3' },
];

const SCIENTIFIC_PRESETS: { label: string; expr: string }[] = [
  { label: 'cos(60°)', expr: 'cos(60)' },
  { label: 'sin(30°)² + cos(30°)²', expr: 'sin(30)^2 + cos(30)^2' },
  { label: 'tan(45°)', expr: 'tan(45)' },
  { label: '√(3² + 4²)', expr: 'sqrt(3^2 + 4^2)' },
  { label: '2π × 10', expr: '2 * pi * 10' },
  { label: 'log₁₀(1000)', expr: 'log(1000)' },
  { label: 'nCr(10, 3)', expr: 'nCr(10, 3)' },
  { label: '7!', expr: '7!' },
];

interface ScientificCalculatorPanelProps {
  onModeChange?: (mode: 'scientific' | 'standard') => void;
}

export const ScientificCalculatorPanel: React.FC<ScientificCalculatorPanelProps> = ({
  onModeChange,
}) => {
  const [mode, setMode] = useState<'scientific' | 'standard'>('scientific');
  const [angleUnit, setAngleUnit] = useState<AngleUnit>('DEG');
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>('STD');
  const [expression, setExpression] = useState<string>('0');
  const [ans, setAns] = useState<number>(0);
  const [memory, setMemory] = useState<number>(0);
  const [isInverse, setIsInverse] = useState<boolean>(false);
  const [copiedTape, setCopiedTape] = useState<boolean>(false);

  const [tapeByMode, setTapeByMode] = useState<Record<'scientific' | 'standard', TapeEntry[]>>({
    scientific: [],
    standard: [],
  });
  const history = tapeByMode[mode];
  const exprInputRef = useRef<HTMLInputElement | null>(null);

  const handleModeSwitch = (nextMode: 'scientific' | 'standard') => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setExpression('0');
    setAns(0);
    setIsInverse(false);
    if (nextMode === 'standard') {
      setDisplayFormat('STD');
    }
    onModeChange?.(nextMode);
  };

  const liveEval = useMemo(() => {
    try {
      const effectiveAngle: AngleUnit = mode === 'standard' ? 'DEG' : angleUnit;
      const effectiveFmt: DisplayFormat = mode === 'standard' ? 'STD' : displayFormat;
      const val = evaluateScientificExpression(expression, effectiveAngle, ans);
      return {
        ok: true as const,
        raw: val,
        formatted: formatNumberDisplay(val, effectiveFmt),
      };
    } catch {
      return { ok: false as const, raw: NaN, formatted: 'Error' };
    }
  }, [expression, angleUnit, ans, displayFormat, mode]);

  const appendToken = useCallback((token: string) => {
    setExpression((prev) =>
      prev === '0' && /^[0-9(a-zπ√]/i.test(token) ? token : `${prev}${token}`
    );
  }, []);

  const handleEquals = useCallback(() => {
    if (!liveEval.ok) return;
    const nowLabel = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setAns(liveEval.raw);
    setTapeByMode((prev) => ({
      ...prev,
      [mode]: [
        {
          expr: expression,
          result: liveEval.formatted,
          angle: mode === 'scientific' ? angleUnit : 'DEC',
          timestamp: nowLabel,
        },
        ...prev[mode],
      ].slice(0, 30),
    }));
    setExpression(liveEval.formatted);
  }, [liveEval, mode, expression, angleUnit]);

  const handleBackspace = useCallback(() => {
    setExpression((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  }, []);

  const handleClearAll = useCallback(() => {
    setExpression('0');
    setAns(0);
    setMemory(0);
    setTapeByMode((prev) => ({ ...prev, [mode]: [] }));
  }, [mode]);

  const handleNegate = () => {
    setExpression((prev) => {
      if (prev === '0') return '0';
      if (prev.startsWith('-(') && prev.endsWith(')')) return prev.slice(2, -1);
      return `-(${prev})`;
    });
  };

  // Global physical keyboard & numpad support
  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const active = document.activeElement as HTMLElement | null;
      const isCalcInput = active === exprInputRef.current;
      const isOtherField =
        active &&
        !isCalcInput &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable);

      if (isOtherField) return;

      if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
        return;
      }

      if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        setExpression('0');
        return;
      }

      // If focus is inside the expression <input>, native typing already updates text smoothly;
      // Only intercept Enter / Escape / = above so cursor editing inside the input stays intact.
      if (isCalcInput) return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
        return;
      }

      if (/^[0-9.]$/.test(e.key)) {
        e.preventDefault();
        appendToken(e.key);
        return;
      }

      if (['+', '-', '*', '/', '(', ')', '%'].includes(e.key)) {
        e.preventDefault();
        appendToken(e.key);
        return;
      }

      if (mode === 'scientific') {
        if (['^', '!', ','].includes(e.key)) {
          e.preventDefault();
          appendToken(e.key);
          return;
        }
        const lower = e.key.toLowerCase();
        if (lower === 'p') { e.preventDefault(); appendToken('pi'); }
        else if (lower === 'r') { e.preventDefault(); appendToken('sqrt('); }
        else if (lower === 's') { e.preventDefault(); appendToken('sin('); }
        else if (lower === 'o') { e.preventDefault(); appendToken('cos('); }
        else if (lower === 't') { e.preventDefault(); appendToken('tan('); }
        else if (lower === 'l') { e.preventDefault(); appendToken('log('); }
        else if (lower === 'n') { e.preventDefault(); appendToken('ln('); }
      }
    };

    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [appendToken, handleBackspace, handleEquals, mode]);

  const handleMemory = (action: 'MC' | 'MR' | 'M+' | 'M-' | 'MS') => {
    if (action === 'MC') setMemory(0);
    else if (action === 'MR') appendToken(String(memory));
    else if (action === 'MS' && liveEval.ok) setMemory(liveEval.raw);
    else if (action === 'M+' && liveEval.ok) setMemory((m) => m + liveEval.raw);
    else if (action === 'M-' && liveEval.ok) setMemory((m) => m - liveEval.raw);
  };

  const exportRows = useMemo(() => {
    if (history.length > 0) {
      return history.map((h) => [h.expr, h.result, h.angle, h.timestamp]);
    }
    return [[expression, liveEval.formatted, mode === 'scientific' ? angleUnit : 'DEC', 'Active']];
  }, [history, expression, liveEval.formatted, mode, angleUnit]);

  const handleCopyTape = async () => {
    const text = exportRows.map((r) => `${r[0]} = ${r[1]} [${r[2]}]`).join('\n');
    await navigator.clipboard.writeText(text);
    setCopiedTape(true);
    window.setTimeout(() => setCopiedTape(false), 1600);
  };

  const handleExportCsv = () => {
    downloadBomCsv({
      filename: `${mode}-calculator-tape.csv`,
      headers: ['Expression', 'Result', mode === 'scientific' ? 'Angle Unit' : 'Mode', 'Time'],
      rows: exportRows,
    });
  };

  const handleExportExcel = () => {
    downloadExcelWorkbook({
      filename: `${mode}-calculator-tape.xlsx`,
      sheets: [
        {
          name: 'Calculation Tape',
          preambleLines: [
            [mode === 'scientific' ? 'Scientific & Engineering Calculator Tape' : 'Standard Calculator Tape'],
            ['Mode', mode, 'Memory', memory],
          ],
          headers: ['Expression', 'Result', mode === 'scientific' ? 'Angle Unit' : 'Mode', 'Time'],
          rows: exportRows,
        },
      ],
    });
  };

  const handleExportWord = () => {
    void downloadWordDocument({
      filename: `${mode}-calculator-tape.docx`,
      title: mode === 'scientific' ? 'Scientific & Engineering Calculation Tape' : 'Standard Calculation Tape',
      subtitle:
        mode === 'scientific'
          ? `Angle Mode: ${angleUnit} | Notation: ${displayFormat} | Memory: ${memory}`
          : `Mode: Standard Arithmetic | Memory: ${memory}`,
      table: {
        title: 'Calculation Tape',
        headers: ['Expression', 'Result', mode === 'scientific' ? 'Angle' : 'Mode', 'Time'],
        rows: exportRows,
      },
    });
  };

  const handleExportJson = () => {
    downloadJsonFile({
      filename: `${mode}-calculator-tape.json`,
      data: {
        mode,
        angleUnit: mode === 'scientific' ? angleUnit : 'DEC',
        displayFormat,
        memory,
        activeExpression: expression,
        activeResult: liveEval.formatted,
        tape: history,
      },
    });
  };

  const handleSavePdf = () => {
    exportStructuredReportPdf({
      title:
        mode === 'scientific'
          ? 'Scientific & Engineering Calculation Tape'
          : 'Standard Calculation Tape',
      subtitle:
        mode === 'scientific'
          ? `Angle Mode: ${angleUnit} | Notation: ${displayFormat} | Memory: ${memory}`
          : `Mode: Standard Arithmetic | Memory: ${memory}`,
      filename: `${mode}-calculator-tape.pdf`,
      table: {
        title: 'Saved Calculations',
        headers: ['Expression', 'Result', mode === 'scientific' ? 'Angle' : 'Mode', 'Time'],
        rows: exportRows,
      },
    });
  };

  const handlePrintTape = () => {
    const esc = (v: string) =>
      v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rowsHtml = exportRows
      .map(
        (r) =>
          `<tr><td>${esc(String(r[0]))}</td><td class="num"><strong>${esc(String(r[1]))}</strong></td><td>${esc(String(r[2]))}</td><td>${esc(String(r[3]))}</td></tr>`
      )
      .join('');
    void printHtmlDocument({
      title: mode === 'scientific' ? 'Scientific Calculator Tape' : 'Standard Calculator Tape',
      bodyHtml: `
        <div style="border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:10px;">
          <h1 style="font-size:17px;">${
            mode === 'scientific'
              ? 'Scientific &amp; Engineering Calculation Tape'
              : 'Standard Calculation Tape'
          }</h1>
          <p style="margin:0;color:#475569;font-size:11px;">${
            mode === 'scientific'
              ? `Active Angle: ${angleUnit} · Notation: ${displayFormat}`
              : 'Mode: Standard Arithmetic'
          } · Memory: ${memory}</p>
        </div>
        <table>
          <thead><tr><th>Expression</th><th>Result</th><th>${
            mode === 'scientific' ? 'Angle' : 'Mode'
          }</th><th>Time</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Keypad & Display */}
      <div className="lg:col-span-7 bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-4 no-print">
        {/* Top Mode & Notation Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#2F3E4E]/15">
          <div className="inline-flex rounded-lg border border-[#2F3E4E]/35 bg-white p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleModeSwitch('scientific')}
              className={`px-3 py-1 rounded-md cursor-pointer transition-colors ${
                mode === 'scientific' ? 'bg-[#2F3E4E] text-white' : 'text-[#475569] hover:text-[#2F3E4E]'
              }`}
            >
              Scientific &amp; Engg
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('standard')}
              className={`px-3 py-1 rounded-md cursor-pointer transition-colors ${
                mode === 'standard' ? 'bg-[#2F3E4E] text-white' : 'text-[#475569] hover:text-[#2F3E4E]'
              }`}
            >
              Standard
            </button>
          </div>

          {mode === 'scientific' ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
              {(['DEG', 'RAD', 'GRAD'] as AngleUnit[]).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setAngleUnit(unit)}
                  className={`px-2.5 py-1 rounded-md border cursor-pointer ${
                    angleUnit === unit
                      ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                      : 'bg-white text-[#475569] border-[#2F3E4E]/30'
                  }`}
                >
                  {unit}
                </button>
              ))}
              <span aria-hidden="true" className="text-slate-300 px-0.5">|</span>
              {(['STD', 'SCI', 'ENG'] as DisplayFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setDisplayFormat(fmt)}
                  className={`px-2 py-1 rounded-md border cursor-pointer ${
                    displayFormat === fmt
                      ? 'bg-[#CEE5DC] text-[#2F3E4E] border-[#2F3E4E]'
                      : 'bg-white text-[#475569] border-[#2F3E4E]/30'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          ) : (
            <span className="px-2.5 py-1 rounded-md border border-[#2F3E4E]/25 bg-[#FEF2C8] text-[11px] font-bold text-[#2F3E4E]">
              Standard Arithmetic Mode
            </span>
          )}
        </div>

        {/* Display Screen */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] text-right space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono font-bold text-[#2F3E4E]/75">
            <span className="inline-flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5" />
              {mode === 'scientific' ? `${angleUnit} · ${displayFormat}` : 'STANDARD · DEC'}{' '}
              {memory !== 0 ? `· M=${memory}` : ''}
              <span className="hidden sm:inline opacity-75">· Physical Keyboard Ready</span>
            </span>
            <span>ANS={ans}</span>
          </div>
          <input
            ref={exprInputRef}
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder={
              mode === 'scientific'
                ? 'Type expression e.g. cos(60) + sqrt(144) or 5!'
                : 'Type expression e.g. (1250 * 18%) + 450'
            }
            aria-label={mode === 'scientific' ? 'Scientific calculator expression' : 'Standard calculator expression'}
            className="w-full bg-transparent text-right font-mono text-base sm:text-lg font-bold text-[#2F3E4E]/85 focus:outline-none"
          />
          <div className="font-mono tabular-nums text-3xl sm:text-4xl font-extrabold text-[#2F3E4E] truncate">
            = {liveEval.formatted}
          </div>
          {mode === 'scientific' && liveEval.ok && Number.isInteger(liveEval.raw) && Math.abs(liveEval.raw) <= 2147483647 && (
            <div className="flex flex-wrap items-center justify-end gap-3 pt-1 border-t border-[#2F3E4E]/15 text-[10px] font-mono text-[#2F3E4E]/80">
              <span>HEX: <strong>0x{(liveEval.raw >>> 0).toString(16).toUpperCase()}</strong></span>
              <span>OCT: <strong>0o{(liveEval.raw >>> 0).toString(8)}</strong></span>
              <span>BIN: <strong>{(liveEval.raw >>> 0).toString(2)}</strong></span>
            </div>
          )}
        </div>

        {/* Memory Bar */}
        <div className="grid grid-cols-5 gap-2">
          {(['MC', 'MR', 'M+', 'M-', 'MS'] as const).map((mBtn) => (
            <button
              key={mBtn}
              type="button"
              onClick={() => handleMemory(mBtn)}
              className="py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white hover:bg-[#FEF2C8] text-xs font-mono font-bold text-[#2F3E4E] cursor-pointer"
            >
              {mBtn}
            </button>
          ))}
        </div>

        {/* Scientific & Engineering Keys */}
        {mode === 'scientific' && (
          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => setIsInverse((v) => !v)}
              className={`min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] text-xs font-extrabold cursor-pointer ${
                isInverse ? 'bg-[#2F3E4E] text-[#F9C80E]' : 'bg-[#FEF2C8] text-[#2F3E4E]'
              }`}
            >
              2nd / INV
            </button>
            <button
              type="button"
              onClick={() => appendToken(isInverse ? 'asin(' : 'sin(')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              {isInverse ? 'sin⁻¹' : 'sin θ'}
            </button>
            <button
              type="button"
              onClick={() => appendToken(isInverse ? 'acos(' : 'cos(')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              {isInverse ? 'cos⁻¹' : 'cos θ'}
            </button>
            <button
              type="button"
              onClick={() => appendToken(isInverse ? 'atan(' : 'tan(')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              {isInverse ? 'tan⁻¹' : 'tan θ'}
            </button>
            <button
              type="button"
              onClick={() => appendToken('pi')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              π
            </button>

            <button
              type="button"
              onClick={() => appendToken(isInverse ? 'sinh(' : 'ln(')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              {isInverse ? 'sinh' : 'ln'}
            </button>
            <button
              type="button"
              onClick={() => appendToken(isInverse ? 'cosh(' : 'log(')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              {isInverse ? 'cosh' : 'log₁₀'}
            </button>
            <button
              type="button"
              onClick={() => appendToken(isInverse ? 'tanh(' : 'log2(')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              {isInverse ? 'tanh' : 'log₂'}
            </button>
            <button
              type="button"
              onClick={() => appendToken(isInverse ? 'exp(' : 'e')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              {isInverse ? 'eˣ' : 'e'}
            </button>
            <button
              type="button"
              onClick={() => appendToken('^')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              xʸ
            </button>

            <button
              type="button"
              onClick={() => appendToken(isInverse ? 'cbrt(' : 'sqrt(')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              {isInverse ? '∛x' : '√x'}
            </button>
            <button
              type="button"
              onClick={() => appendToken('^2')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              x²
            </button>
            <button
              type="button"
              onClick={() => appendToken('10^')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              10ˣ
            </button>
            <button
              type="button"
              onClick={() => appendToken('!')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              n!
            </button>
            <button
              type="button"
              onClick={() => appendToken(' mod ')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              mod
            </button>

            <button
              type="button"
              onClick={() => appendToken('abs(')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              |x|
            </button>
            <button
              type="button"
              onClick={() => appendToken('nCr(')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              nCr(,)
            </button>
            <button
              type="button"
              onClick={() => appendToken('nPr(')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              nPr(,)
            </button>
            <button
              type="button"
              onClick={() => appendToken(',')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              ,
            </button>
            <button
              type="button"
              onClick={() => appendToken('ANS')}
              className="min-h-[42px] rounded-xl border border-[#2F3E4E]/45 bg-[#CEE5DC]/55 hover:bg-[#CEE5DC] font-mono text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              ANS
            </button>
          </div>
        )}

        {/* Primary Arithmetic Keypad */}
        <div className="grid grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => setExpression('0')}
            className="min-h-[46px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFE1B3] hover:bg-[#F9C80E] text-sm font-extrabold text-[#2F3E4E] cursor-pointer"
          >
            AC
          </button>
          <button
            type="button"
            onClick={() => appendToken('(')}
            className="min-h-[46px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] font-mono text-sm font-bold text-[#2F3E4E] cursor-pointer"
          >
            (
          </button>
          <button
            type="button"
            onClick={() => appendToken(')')}
            className="min-h-[46px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] font-mono text-sm font-bold text-[#2F3E4E] cursor-pointer"
          >
            )
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Backspace"
            className="min-h-[46px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-[#2F3E4E] flex items-center justify-center cursor-pointer"
          >
            <Delete className="w-4 h-4" />
          </button>

          {['7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => appendToken(d)}
              className="min-h-[48px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] font-mono text-lg font-bold text-[#2F3E4E] cursor-pointer"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => appendToken('/')}
            className="min-h-[48px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] font-mono text-lg font-bold text-[#2F3E4E] cursor-pointer"
          >
            ÷
          </button>

          {['4', '5', '6'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => appendToken(d)}
              className="min-h-[48px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] font-mono text-lg font-bold text-[#2F3E4E] cursor-pointer"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => appendToken('*')}
            className="min-h-[48px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] font-mono text-lg font-bold text-[#2F3E4E] cursor-pointer"
          >
            ×
          </button>

          {['1', '2', '3'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => appendToken(d)}
              className="min-h-[48px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] font-mono text-lg font-bold text-[#2F3E4E] cursor-pointer"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => appendToken('-')}
            className="min-h-[48px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] font-mono text-lg font-bold text-[#2F3E4E] cursor-pointer"
          >
            −
          </button>

          <button
            type="button"
            onClick={() => appendToken('0')}
            className="min-h-[48px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] font-mono text-lg font-bold text-[#2F3E4E] cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => appendToken('.')}
            className="min-h-[48px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] font-mono text-lg font-bold text-[#2F3E4E] cursor-pointer"
          >
            .
          </button>
          <button
            type="button"
            onClick={() => appendToken('%')}
            className="min-h-[48px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] font-mono text-base font-bold text-[#2F3E4E] cursor-pointer"
          >
            %
          </button>
          <button
            type="button"
            onClick={() => appendToken('+')}
            className="min-h-[48px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] font-mono text-lg font-bold text-[#2F3E4E] cursor-pointer"
          >
            +
          </button>

          <button
            type="button"
            onClick={handleNegate}
            className="min-h-[50px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] font-mono text-sm font-extrabold text-[#2F3E4E] cursor-pointer"
          >
            +/−
          </button>
          <button
            type="button"
            onClick={() => setExpression((prev) => (prev === '0' ? '0' : `1/(${prev})`))}
            className="min-h-[50px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] font-mono text-sm font-extrabold text-[#2F3E4E] cursor-pointer"
          >
            1/x
          </button>
          <button
            type="button"
            onClick={handleEquals}
            className="col-span-2 min-h-[50px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Equal className="w-4 h-4" />
            <span>Calculate (=)</span>
          </button>
        </div>
      </div>

      {/* Right Column: Calculation Tape + Quick Engineering Examples + Exports */}
      <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-5">
        <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#2F3E4E]/15">
            <h2 className="font-display font-bold text-base text-[#2F3E4E]">
              {mode === 'scientific' ? 'Scientific Calculation Tape' : 'Standard Calculation Tape'} ({history.length})
            </h2>
            <button
              type="button"
              onClick={() => setTapeByMode((prev) => ({ ...prev, [mode]: [] }))}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#475569] hover:text-[#2F3E4E] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          {history.length === 0 ? (
            <p className="text-xs text-[#64748B] py-6 text-center">
              No saved {mode === 'scientific' ? 'scientific' : 'standard'} calculations yet. Press Enter or Calculate to log to the tape.
            </p>
          ) : (
            <ul className="divide-y divide-[#2F3E4E]/10 max-h-[300px] overflow-y-auto pr-1">
              {history.map((item, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => setExpression(item.result)}
                    className="w-full py-2.5 px-2 rounded-lg hover:bg-[#FEF2C8]/60 text-left flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-xs text-[#475569] block truncate">
                        {item.expr}
                      </span>
                      <span className="text-[10px] text-[#64748B]">
                        {item.angle} · {item.timestamp}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-sm font-bold text-[#2F3E4E] shrink-0">
                      {item.result}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-3 border-t border-[#2F3E4E]/15 flex flex-wrap gap-1.5 no-print">
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-[#FFE1B3] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
            <button
              type="button"
              onClick={handleCopyTape}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-semibold cursor-pointer"
            >
              {copiedTape ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedTape ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-[#CEE5DC] hover:bg-[#bddbd0] text-xs font-semibold cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-white hover:bg-[#CEE5DC] text-xs font-semibold cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportWord}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-[#E0F2FE] hover:bg-[#bae6fd] text-xs font-semibold text-[#0F172A] cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Word</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-semibold cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
            <button
              type="button"
              onClick={handleSavePdf}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#fde047] text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Save PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrintTape}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2F3E4E] text-white text-xs font-semibold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Mode-Specific Quick Formula Presets */}
        <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-3 no-print">
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-[#475569]">
            {mode === 'scientific'
              ? 'Quick Scientific & Engineering Presets'
              : 'Quick Standard Business & Arithmetic Presets'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {(mode === 'scientific' ? SCIENTIFIC_PRESETS : STANDARD_PRESETS).map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setExpression(p.expr)}
                className="px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 bg-white hover:bg-[#FEF2C8] text-xs font-mono font-bold text-[#2F3E4E] cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
