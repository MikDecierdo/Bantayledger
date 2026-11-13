import { jsPDF } from 'jspdf';
import { t } from '../i18n';
import { ascii, type ExportFormat, exportFileName } from './receipt';

/**
 * A printable document on short bond paper (Letter, 8.5 x 11 in), drawn the
 * same way to a PDF and to a PNG: the layout is worked out once in millimetres
 * (measured with jsPDF's Helvetica), then each page's drawing steps are played
 * back on jsPDF or on a canvas.
 */

export const PAGE_W = 215.9;
export const PAGE_H = 279.4;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
/** Content stops here; the footer sits below. */
const BOTTOM = PAGE_H - 20;
const PT_TO_MM = 25.4 / 72;

const GREEN = '#1F7A4D';
const GREEN_SOFT = '#E7F3EC';
const INK = '#1A1A1A';
const MUTED = '#666666';
const RULE = '#D9D9D9';

type FontStyle = 'normal' | 'bold' | 'italic';
type Align = 'left' | 'right' | 'center';

type Op =
  | { k: 'text'; x: number; y: number; s: string; size: number; style: FontStyle; color: string; align: Align }
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { k: 'image'; data: string; x: number; y: number; w: number; h: number };

export interface Column {
  label: string;
  /** Share of the table width. */
  width: number;
  align?: Align;
}

export interface Cell {
  text: string;
  color?: string;
  bold?: boolean;
}

export interface PaperMeta {
  title: string;
  businessName: string;
  periodLabel: string;
  generatedAt: string;
  preparedBy: string;
  logo: string | null;
}

/** Lays the document out page by page. */
export class PaperDoc {
  readonly pages: Op[][] = [];
  private y = MARGIN;
  private readonly measure = new jsPDF({ unit: 'mm', format: 'letter' });

  private readonly meta: PaperMeta;

  constructor(meta: PaperMeta) {
    this.meta = meta;
    this.newPage();
  }

  // ---- measuring ------------------------------------------------------------

  private font(size: number, style: FontStyle) {
    this.measure.setFont('helvetica', style);
    this.measure.setFontSize(size);
  }

  width(s: string, size: number, style: FontStyle = 'normal'): number {
    this.font(size, style);
    return this.measure.getTextWidth(ascii(s));
  }

  private split(s: string, w: number, size: number, style: FontStyle): string[] {
    this.font(size, style);
    return this.measure.splitTextToSize(ascii(s), w) as string[];
  }

  /** Largest size up to `size` that fits `s` in `w`. */
  private fit(s: string, w: number, size: number, style: FontStyle): number {
    let out = size;
    while (out > 6 && this.width(s, out, style) > w) out -= 0.5;
    return out;
  }

  // ---- drawing --------------------------------------------------------------

  private get ops(): Op[] {
    return this.pages[this.pages.length - 1];
  }

  private text(s: string, x: number, y: number, size: number, opts: { style?: FontStyle; color?: string; align?: Align } = {}) {
    this.ops.push({ k: 'text', x, y, s: ascii(s), size, style: opts.style ?? 'normal', color: opts.color ?? INK, align: opts.align ?? 'left' });
  }

  private line(x1: number, y1: number, x2: number, y2: number, color = RULE, width = 0.2) {
    this.ops.push({ k: 'line', x1, y1, x2, y2, color, width });
  }

  private rect(x: number, y: number, w: number, h: number, fill?: string, stroke?: string) {
    this.ops.push({ k: 'rect', x, y, w, h, fill, stroke });
  }

  // ---- pages ----------------------------------------------------------------

  private newPage() {
    this.pages.push([]);
    const m = this.meta;
    if (this.pages.length === 1) {
      // Full heading on the first page.
      const logo = 18;
      let left = MARGIN;
      if (m.logo) {
        this.ops.push({ k: 'image', data: m.logo, x: MARGIN, y: MARGIN, w: logo, h: logo });
        left += logo + 5;
      }
      const rightW = 62;
      const nameW = PAGE_W - MARGIN - rightW - left - 4;
      this.text(m.businessName, left, MARGIN + 6.5, this.fit(m.businessName, nameW, 18, 'bold'), { style: 'bold' });
      this.text(m.title, left, MARGIN + 12.5, 12, { color: GREEN, style: 'bold' });
      this.text(m.periodLabel, left, MARGIN + 17.5, this.fit(m.periodLabel, nameW, 10, 'normal'), { color: MUTED });

      const right = PAGE_W - MARGIN;
      this.text(t('Generated'), right, MARGIN + 5, 8, { color: MUTED, align: 'right' });
      this.text(m.generatedAt, right, MARGIN + 9.5, 9.5, { align: 'right' });
      if (m.preparedBy) {
        this.text(t('Prepared by'), right, MARGIN + 14.5, 8, { color: MUTED, align: 'right' });
        this.text(m.preparedBy, right, MARGIN + 19, this.fit(m.preparedBy, rightW, 9.5, 'normal'), { align: 'right' });
      }
      this.line(MARGIN, MARGIN + 23, PAGE_W - MARGIN, MARGIN + 23, GREEN, 0.8);
      this.y = MARGIN + 30;
    } else {
      // A slim running heading on the pages after.
      this.text(`${m.businessName} - ${m.title}`, MARGIN, MARGIN, 8.5, { style: 'bold' });
      this.text(m.periodLabel, PAGE_W - MARGIN, MARGIN, 8.5, { color: MUTED, align: 'right' });
      this.line(MARGIN, MARGIN + 2.5, PAGE_W - MARGIN, MARGIN + 2.5, GREEN, 0.5);
      this.y = MARGIN + 9;
    }
  }

  /** Starts a new page when less than `need` mm is left. */
  private ensure(need: number) {
    if (this.y + need > BOTTOM) this.newPage();
  }

  // ---- blocks ---------------------------------------------------------------

  /** A row of figure boxes. */
  boxes(items: { label: string; value: string; color?: string }[]) {
    const gap = 3;
    const h = 18;
    const w = (CONTENT_W - gap * (items.length - 1)) / items.length;
    this.ensure(h + 4);
    items.forEach((item, i) => {
      const x = MARGIN + i * (w + gap);
      this.rect(x, this.y, w, h, i === items.length - 1 ? GREEN_SOFT : '#FAFAFA', RULE);
      this.text(item.label, x + 3, this.y + 6, this.fit(item.label, w - 6, 8, 'normal'), { color: MUTED });
      this.text(item.value, x + 3, this.y + 13.5, this.fit(item.value, w - 6, 11, 'bold'), { style: 'bold', color: item.color ?? INK });
    });
    this.y += h + 8;
  }

  private sectionTitle(title: string) {
    this.text(title, MARGIN, this.y + 4.5, 12, { style: 'bold', color: GREEN });
    this.y += 8;
  }

  /** A titled table; continues on the next page with its header row repeated. */
  table(title: string, columns: Column[], rows: Cell[][], opts: { total?: Cell[]; empty?: string } = {}) {
    const size = 9;
    const lineH = size * PT_TO_MM * 1.25;
    const pad = 1.7;
    const totalShare = columns.reduce((sum, c) => sum + c.width, 0);
    const widths = columns.map((c) => (c.width / totalShare) * CONTENT_W);
    const xs = widths.map((_, i) => MARGIN + widths.slice(0, i).reduce((a, b) => a + b, 0));
    const headH = 7.5;

    const cellX = (i: number) => {
      const align = columns[i].align ?? 'left';
      return align === 'right' ? xs[i] + widths[i] - pad : align === 'center' ? xs[i] + widths[i] / 2 : xs[i] + pad;
    };
    const header = () => {
      this.rect(MARGIN, this.y, CONTENT_W, headH, GREEN_SOFT);
      columns.forEach((c, i) => this.text(c.label, cellX(i), this.y + 5, 8.5, { style: 'bold', color: GREEN, align: c.align ?? 'left' }));
      this.y += headH;
    };
    const layoutRow = (cells: Cell[], bold: boolean) => {
      const lines = cells.map((c, i) => this.split(c.text, widths[i] - pad * 2, size, c.bold || bold ? 'bold' : 'normal'));
      return { lines, h: Math.max(...lines.map((l) => l.length)) * lineH + pad * 2 };
    };
    const drawRow = (cells: Cell[], bold: boolean, row: ReturnType<typeof layoutRow>) => {
      cells.forEach((c, i) => {
        row.lines[i].forEach((ln, j) => {
          this.text(ln, cellX(i), this.y + pad + lineH * (j + 0.78), size, {
            style: c.bold || bold ? 'bold' : 'normal',
            color: c.color ?? INK,
            align: columns[i].align ?? 'left',
          });
        });
      });
      this.y += row.h;
    };

    if (rows.length === 0) {
      this.ensure(18);
      this.sectionTitle(title);
      this.text(opts.empty ?? '', MARGIN, this.y + 4, 9.5, { style: 'italic', color: MUTED });
      this.y += 13;
      return;
    }

    const first = layoutRow(rows[0], false);
    this.ensure(8 + headH + first.h);
    this.sectionTitle(title);
    header();
    rows.forEach((cells, i) => {
      const row = i === 0 ? first : layoutRow(cells, false);
      if (this.y + row.h > BOTTOM) {
        this.newPage();
        this.sectionTitle(t('{{title}} (continued)', { title }));
        header();
      }
      if (i % 2 === 1) this.rect(MARGIN, this.y, CONTENT_W, row.h, '#FAFAFA');
      drawRow(cells, false, row);
      this.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    });
    if (opts.total) {
      const row = layoutRow(opts.total, true);
      if (this.y + row.h > BOTTOM) {
        this.newPage();
        header();
      }
      this.line(MARGIN, this.y, PAGE_W - MARGIN, this.y, INK, 0.4);
      drawRow(opts.total, true, row);
    }
    this.y += 9;
  }

  /** Adds the footer with page numbers to every page. */
  finish(): Op[][] {
    const total = this.pages.length;
    this.pages.forEach((ops, i) => {
      const y = PAGE_H - 11;
      ops.push({ k: 'line', x1: MARGIN, y1: y - 4, x2: PAGE_W - MARGIN, y2: y - 4, color: RULE, width: 0.3 });
      ops.push({ k: 'text', x: MARGIN, y, s: ascii(`BantayLedger AI - ${this.meta.businessName}`), size: 8, style: 'normal', color: MUTED, align: 'left' });
      ops.push({ k: 'text', x: PAGE_W - MARGIN, y, s: ascii(t('Page {{page}} of {{total}}', { page: i + 1, total })), size: 8, style: 'normal', color: MUTED, align: 'right' });
    });
    return this.pages;
  }
}

// ---- output -------------------------------------------------------------------

function hex(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function paperPdf(pages: Op[][]): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  pages.forEach((ops, i) => {
    if (i > 0) doc.addPage('letter', 'portrait');
    for (const op of ops) {
      if (op.k === 'text') {
        doc.setFont('helvetica', op.style);
        doc.setFontSize(op.size);
        doc.setTextColor(...hex(op.color));
        doc.text(op.s, op.x, op.y, { align: op.align });
      } else if (op.k === 'rect') {
        if (op.fill) doc.setFillColor(...hex(op.fill));
        if (op.stroke) {
          doc.setDrawColor(...hex(op.stroke));
          doc.setLineWidth(0.25);
        }
        doc.rect(op.x, op.y, op.w, op.h, op.fill && op.stroke ? 'FD' : op.fill ? 'F' : 'S');
      } else if (op.k === 'line') {
        doc.setDrawColor(...hex(op.color));
        doc.setLineWidth(op.width);
        doc.line(op.x1, op.y1, op.x2, op.y2);
      } else {
        doc.addImage(op.data, 'PNG', op.x, op.y, op.w, op.h);
      }
    }
  });
  return doc;
}

const FAMILY = 'Helvetica, Arial, sans-serif';
const PAGE_GAP_PX = 28;
/** Keeps a long report's image under what phones can draw. */
const MAX_CANVAS_PX = 30000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** All pages, one under the other, at 150 dpi (less for very long reports). */
export async function paperCanvas(pages: Op[][]): Promise<HTMLCanvasElement> {
  const images = new Map<string, HTMLImageElement>();
  for (const ops of pages) {
    for (const op of ops) if (op.k === 'image' && !images.has(op.data)) images.set(op.data, await loadImage(op.data));
  }

  let scale = 150 / 25.4;
  const heightAt = (s: number) => pages.length * PAGE_H * s + (pages.length - 1) * PAGE_GAP_PX;
  if (heightAt(scale) > MAX_CANVAS_PX) scale = (MAX_CANVAS_PX - (pages.length - 1) * PAGE_GAP_PX) / (pages.length * PAGE_H);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_W * scale);
  canvas.height = Math.round(heightAt(scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(t('Canvas is not available.'));
  ctx.fillStyle = '#C8C8C8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  pages.forEach((ops, i) => {
    ctx.save();
    ctx.translate(0, i * (PAGE_H * scale + PAGE_GAP_PX));
    ctx.scale(scale, scale);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.textBaseline = 'alphabetic';
    for (const op of ops) {
      if (op.k === 'text') {
        const style = op.style === 'bold' ? 'bold ' : op.style === 'italic' ? 'italic ' : '';
        ctx.font = `${style}${op.size * PT_TO_MM}px ${FAMILY}`;
        ctx.fillStyle = op.color;
        ctx.textAlign = op.align;
        ctx.fillText(op.s, op.x, op.y);
      } else if (op.k === 'rect') {
        if (op.fill) {
          ctx.fillStyle = op.fill;
          ctx.fillRect(op.x, op.y, op.w, op.h);
        }
        if (op.stroke) {
          ctx.strokeStyle = op.stroke;
          ctx.lineWidth = 0.25;
          ctx.strokeRect(op.x, op.y, op.w, op.h);
        }
      } else if (op.k === 'line') {
        ctx.strokeStyle = op.color;
        ctx.lineWidth = op.width;
        ctx.beginPath();
        ctx.moveTo(op.x1, op.y1);
        ctx.lineTo(op.x2, op.y2);
        ctx.stroke();
      } else {
        const img = images.get(op.data);
        if (img) ctx.drawImage(img, op.x, op.y, op.w, op.h);
      }
    }
    ctx.restore();
  });
  return canvas;
}

/** The app logo as a data URL, or null if it can't be loaded. */
export async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch('/brand-logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Saves the laid-out pages as a PDF or a PNG. */
export async function savePaper(pages: Op[][], baseName: string, format: ExportFormat): Promise<void> {
  const fileName = exportFileName(baseName, format);
  if (format === 'pdf') {
    paperPdf(pages).save(fileName);
    return;
  }
  const canvas = await paperCanvas(pages);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error(t('Could not create the image.'));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
