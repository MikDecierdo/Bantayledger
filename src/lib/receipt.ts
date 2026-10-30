import { jsPDF } from 'jspdf';
import { intlLocale, t } from '../i18n';

/**
 * A receipt: a narrow, monospaced, line-by-line printout. Pages build one list
 * of lines with `ReceiptBuilder`; the PDF and PNG renderers below draw that
 * same list, so the two files always match.
 */

/** Characters per line. Everything is laid out in whole columns. */
export const COLS = 40;

export type ReceiptLine =
  | { kind: 'text'; text: string; bold?: boolean }
  | { kind: 'blank' };

// ---- Formatting helpers ------------------------------------------------------

/** e.g. "bantayledger-dashboard-2026-10-08.pdf" */
export function exportFileName(base: string, ext: 'pdf' | 'png'): string {
  return `bantayledger-${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

// jsPDF's built-in fonts don't include the ₱ glyph (it prints as garbage), so
// receipts write "PHP" — in the PNG too, so both files read the same.
export function php(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}PHP ${Math.abs(value).toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function qty(value: number): string {
  return value.toLocaleString(intlLocale(), { maximumFractionDigits: 1 });
}

export function pct(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

/** "Oct 8, 2026  9:21 AM" */
export function receiptTimestamp(): string {
  const d = new Date();
  const date = d.toLocaleDateString(intlLocale(), { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(intlLocale(), { hour: 'numeric', minute: '2-digit' });
  return `${date}  ${time}`;
}

// ---- Builder -----------------------------------------------------------------

/** jsPDF's built-in Courier only covers basic Latin; swap look-alikes so nothing prints as garbage. */
function ascii(text: string): string {
  return text.replace(/[–—]/g, '-').replace(/[·•]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

/** Splits text into chunks of at most `width` characters, breaking at spaces where it can. */
function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > width) {
    let cut = rest.lastIndexOf(' ', width);
    if (cut < width / 2) cut = width;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  out.push(rest);
  return out;
}

export class ReceiptBuilder {
  readonly lines: ReceiptLine[] = [];

  blank(): this {
    this.lines.push({ kind: 'blank' });
    return this;
  }

  /** Centered, wrapped to the receipt width. */
  center(text: string, bold = false): this {
    for (const part of wrap(ascii(text), COLS)) {
      const pad = Math.floor((COLS - part.length) / 2);
      this.lines.push({ kind: 'text', text: ' '.repeat(pad) + part, bold });
    }
    return this;
  }

  rule(style: 'dash' | 'double' = 'dash'): this {
    this.lines.push({ kind: 'text', text: (style === 'dash' ? '-' : '=').repeat(COLS) });
    return this;
  }

  /** A bold section title, left-aligned. */
  title(text: string): this {
    for (const part of wrap(ascii(text).toUpperCase(), COLS)) this.lines.push({ kind: 'text', text: part, bold: true });
    return this;
  }

  /** Plain left-aligned text (wrapped), optionally indented. */
  text(text: string, indent = 0): this {
    for (const part of wrap(ascii(text), COLS - indent)) {
      this.lines.push({ kind: 'text', text: ' '.repeat(indent) + part });
    }
    return this;
  }

  /**
   * `left` ........ `right`. If they don't fit on one line, the left text
   * wraps and the right text sits on the last line.
   */
  row(left: string, right = '', opts: { indent?: number; bold?: boolean } = {}): this {
    const indent = opts.indent ?? 0;
    const avail = COLS - indent;
    const room = right ? avail - right.length - 1 : avail;
    const parts = wrap(ascii(left), Math.max(room, 8));

    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      const line =
        last && right
          ? part + ' '.repeat(Math.max(1, avail - part.length - right.length)) + right
          : part;
      this.lines.push({ kind: 'text', text: ' '.repeat(indent) + line, bold: opts.bold });
    });
    return this;
  }

  /** A section: rule, bold title, then whatever `fill` adds. */
  section(title: string, fill: () => void): this {
    this.rule().title(title);
    fill();
    return this;
  }

  /** Standard closing block. */
  footer(): this {
    return this.blank().rule('double').center(t('Thank you')).center('BantayLedger').blank();
  }
}

// ---- PDF ---------------------------------------------------------------------

const PAGE_WIDTH_MM = 80;
const MARGIN_MM = 6;
const FONT_PT = 8;
const LINE_MM = 3.6;

/** One long 80 mm page, so the PDF prints on a receipt printer as well as A4. */
export function renderReceiptPdf(lines: ReceiptLine[], fileName: string): void {
  const height = MARGIN_MM * 2 + lines.length * LINE_MM;
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_WIDTH_MM, height] });
  doc.setFont('courier', 'normal');
  doc.setFontSize(FONT_PT);
  doc.setTextColor(0, 0, 0);

  lines.forEach((line, i) => {
    if (line.kind !== 'text') return;
    doc.setFont('courier', line.bold ? 'bold' : 'normal');
    // Baseline sits about 0.8 of a line down from the line's top.
    doc.text(line.text, MARGIN_MM, MARGIN_MM + i * LINE_MM + LINE_MM * 0.8);
  });

  doc.save(fileName);
}

// ---- PNG ---------------------------------------------------------------------

const PNG_FONT_PX = 15;
const PNG_PAD_PX = 22;
const PNG_LINE_PX = 21;
const PNG_FAMILY = '"Courier New", Courier, monospace';

interface DrawContext {
  font: string;
  fillStyle: unknown;
  textBaseline: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  scale(x: number, y: number): void;
}

/** Pixel size of the receipt at 1x. Needs a context to measure the font. */
export function receiptPngSize(ctx: DrawContext, lines: ReceiptLine[]): { width: number; height: number } {
  ctx.font = `${PNG_FONT_PX}px ${PNG_FAMILY}`;
  const charWidth = ctx.measureText('M').width;
  return {
    width: Math.ceil(COLS * charWidth + PNG_PAD_PX * 2),
    height: PNG_PAD_PX * 2 + lines.length * PNG_LINE_PX,
  };
}

/** Draws the receipt onto a context that is already sized and scaled. */
export function drawReceipt(ctx: DrawContext, lines: ReceiptLine[]): void {
  const { width, height } = receiptPngSize(ctx, lines);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#111111';
  ctx.textBaseline = 'top';

  lines.forEach((line, i) => {
    if (line.kind !== 'text') return;
    ctx.font = `${line.bold ? 'bold ' : ''}${PNG_FONT_PX}px ${PNG_FAMILY}`;
    ctx.fillText(line.text, PNG_PAD_PX, PNG_PAD_PX + i * PNG_LINE_PX + 2);
  });
}

/** Draws the receipt on a canvas (sharp at 2x) and downloads it as a PNG. */
export async function renderReceiptPng(lines: ReceiptLine[], fileName: string): Promise<void> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(t('Canvas is not available.'));

  const { width, height } = receiptPngSize(ctx, lines);
  const ratio = 2;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.scale(ratio, ratio);
  drawReceipt(ctx, lines);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error(t('Could not create the image.'));

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ExportFormat = 'pdf' | 'png';

/** Saves a receipt in the chosen format. */
export async function saveReceipt(lines: ReceiptLine[], baseName: string, format: ExportFormat): Promise<void> {
  const fileName = exportFileName(baseName, format);
  if (format === 'pdf') renderReceiptPdf(lines, fileName);
  else await renderReceiptPng(lines, fileName);
}
