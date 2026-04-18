import { useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { formatDateTime } from '../utils/formatters.js';

async function loadImageAsDataURL(src) {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload  = () => resolve({ dataURL: reader.result, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ dataURL: reader.result, w: 200, h: 200 });
        img.src = reader.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function generateReceiptPDF(sale, settings) {
  const currency = settings?.currency || 'GHS';
  const items    = sale.items ?? [];
  const total    = Number(sale.grand_total || 0);

  // ── Page dimensions ───────────────────────────────────────────
  const W  = 80;   // mm — standard 80mm thermal width
  const ML = 6;    // left margin
  const MR = 6;    // right margin
  const CW = W - ML - MR; // content width = 68mm

  // ── Typography scale ──────────────────────────────────────────
  const LH = {
    xs:  3.2,
    sm:  3.8,
    md:  4.4,
    lg:  5.2,
    xl:  6.5,
  };

  // Estimate page height
  const logoH   = settings?.logo_url ? 24 : 0;
  const itemsH  = items.reduce((acc) => acc + LH.sm + 1, 0) + LH.sm + 4;
  const estH    = logoH + 60 + itemsH + 40;
  const pageH   = Math.max(estH, 120);

  const doc = new jsPDF({ unit: 'mm', format: [W, pageH], orientation: 'portrait' });

  let y = 7; // start with top padding

  // ── Helpers ───────────────────────────────────────────────────
  const setFont = (style = 'normal', size = 8) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  };

  const centerText = (text, yPos, size = 8, style = 'normal') => {
    setFont(style, size);
    doc.text(String(text), W / 2, yPos, { align: 'center' });
    return yPos + (size >= 11 ? LH.lg : size >= 9 ? LH.md : LH.sm);
  };

  const leftText = (text, yPos, size = 8, style = 'normal') => {
    setFont(style, size);
    doc.text(String(text), ML, yPos);
    return yPos + LH.sm;
  };

  const rightText = (text, yPos, size = 8, style = 'normal') => {
    setFont(style, size);
    doc.text(String(text), W - MR, yPos, { align: 'right' });
  };

  const solidLine = (yPos, thickness = 0.4) => {
    doc.setLineWidth(thickness);
    doc.setLineDashPattern([], 0);
    doc.line(ML, yPos, W - MR, yPos);
    return yPos + 2.5;
  };

  const dashedLine = (yPos) => {
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1.5, 1], 0);
    doc.line(ML, yPos, W - MR, yPos);
    doc.setLineDashPattern([], 0);
    return yPos + 2.5;
  };

  const twoCol = (left, right, yPos, leftStyle = 'normal', rightStyle = 'normal', size = 8) => {
    setFont(leftStyle, size);
    doc.text(String(left), ML, yPos);
    setFont(rightStyle, size);
    doc.text(String(right), W - MR, yPos, { align: 'right' });
    return yPos + LH.sm;
  };

  // ── LOGO ──────────────────────────────────────────────────────
  if (settings?.logo_url) {
    const src  = settings.logo_url.startsWith('http') ? settings.logo_url : settings.logo_url;
    const logo = await loadImageAsDataURL(src);
    if (logo) {
      const maxW = 30, maxH = 20;
      const wMM  = logo.w * 0.264583;
      const hMM  = logo.h * 0.264583;
      const ratio = Math.min(maxW / wMM, maxH / hMM, 1);
      const dW = wMM * ratio;
      const dH = hMM * ratio;
      doc.addImage(logo.dataURL, 'PNG', (W - dW) / 2, y, dW, dH);
      y += dH + 4;
    }
  }

  // ── SHOP HEADER ───────────────────────────────────────────────
  if (settings?.shop_name) {
    y = centerText(settings.shop_name, y, 13, 'bold');
    y += 0.5;
  }
  if (settings?.shop_address) {
    y = centerText(settings.shop_address, y, 7.5, 'normal');
  }
  if (settings?.phone_number || settings?.phone_number_2) {
    const phones = [settings.phone_number, settings.phone_number_2].filter(Boolean).join(' / ');
    y = centerText(`Tel: ${phones}`, y, 7.5, 'normal');
  }
  if (settings?.receipt_header) {
    y += 1;
    y = centerText(settings.receipt_header, y, 7.5, 'italic');
  }

  y += 2;
  y = solidLine(y, 0.5);
  y += 1;

  // ── RECEIPT TITLE ─────────────────────────────────────────────
  y = centerText('SALES RECEIPT', y, 8.5, 'bold');
  y += 1;
  y = dashedLine(y);
  y += 0.5;

  // ── RECEIPT META ──────────────────────────────────────────────
  setFont('normal', 7.5);
  const col2 = ML + 20; // label col width

  // Receipt #
  setFont('bold', 7.5);
  doc.text('Receipt #', ML, y);
  setFont('normal', 7.5);
  doc.text(String(sale.receipt_number), col2, y);
  y += LH.sm;

  // Date
  setFont('bold', 7.5);
  doc.text('Date', ML, y);
  setFont('normal', 7.5);
  doc.text(formatDateTime(sale.created_at), col2, y);
  y += LH.sm;

  // Cashier
  setFont('bold', 7.5);
  doc.text('Cashier', ML, y);
  setFont('normal', 7.5);
  doc.text(String(sale.cashier_name), col2, y);
  y += LH.sm + 1;

  y = dashedLine(y);
  y += 1;

  // ── ITEMS HEADER ──────────────────────────────────────────────
  const C = {
    item:  ML,
    qty:   ML + 34,
    price: ML + 48,
    amt:   W - MR,
  };

  setFont('bold', 7.5);
  doc.text('ITEM',          C.item,  y);
  doc.text('QTY',           C.qty,   y, { align: 'right' });
  doc.text('PRICE',         C.price, y, { align: 'right' });
  doc.text('AMOUNT',        C.amt,   y, { align: 'right' });
  y += LH.sm;

  y = solidLine(y, 0.3);
  y += 0.5;

  // ── ITEMS ─────────────────────────────────────────────────────
  setFont('normal', 7.5);

  for (const item of items) {
    const name    = String(item.product_name ?? '');
    const qty     = Number(item.quantity).toFixed(2);
    const price   = Number(item.unit_price).toFixed(2);
    const amt     = Number(item.subtotal).toFixed(2);

    // Wrap name if too long (max ~38mm)
    const nameLines = doc.splitTextToSize(name, 30);

    setFont('normal', 7.5);
    nameLines.forEach((line, i) => doc.text(line, C.item, y + i * LH.sm));

    setFont('normal', 7.5);
    doc.text(qty,   C.qty,   y, { align: 'right' });
    doc.text(price, C.price, y, { align: 'right' });
    setFont('bold', 7.5);
    doc.text(amt,   C.amt,   y, { align: 'right' });

    y += Math.max(nameLines.length, 1) * LH.sm + 1.5;
  }

  y += 0.5;
  y = solidLine(y, 0.3);
  y += 1.5;

  // ── SUBTOTAL / TOTAL ──────────────────────────────────────────
  // Items count
  const totalQty = items.reduce((s, i) => s + Number(i.quantity), 0);
  setFont('normal', 7.5);
  doc.text(`${items.length} item(s) — ${totalQty.toFixed(2)} units`, ML, y);
  y += LH.sm + 1;

  // Total box
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(ML, y, CW, 9, 1, 1, 'F');
  setFont('bold', 9.5);
  doc.text(`TOTAL`, ML + 2.5, y + 5.8);
  doc.text(`${currency} ${total.toFixed(2)}`, W - MR - 2.5, y + 5.8, { align: 'right' });
  y += 9 + 3;

  y = dashedLine(y);
  y += 1;

  // ── FOOTER ────────────────────────────────────────────────────
  if (settings?.receipt_footer) {
    y = centerText(settings.receipt_footer, y, 7.5, 'italic');
    y += 1;
  }
  y = centerText('Thank you for your business!', y, 7.5, 'normal');
  y += 1.5;
  y = centerText('*** Please come again ***', y, 7, 'normal');
  y += 2;

  // Trim page
  doc.internal.pageSize.height = y + 5;

  doc.save(`receipt-${sale.receipt_number}.pdf`);
}

export default function ReceiptPrinter({ sale, settings, onDone, onError }) {
  const generated = useRef(false);

  useEffect(() => {
    if (!sale || generated.current) return;
    generated.current = true;

    generateReceiptPDF(sale, settings)
      .then(() => onDone?.())
      .catch((err) => {
        console.error('PDF generation failed:', err);
        onError?.(err);
      });
  }, [sale]);

  return null;
}
