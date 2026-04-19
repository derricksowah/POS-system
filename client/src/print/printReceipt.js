import { formatDateTime } from '../utils/formatters.js';

/**
 * Opens a styled receipt in a new window and triggers the browser print dialog.
 * Works with 80mm thermal printers — just select the thermal printer in the dialog.
 * Also works as "Print to PDF" when no printer is connected.
 */
export function printReceipt(sale, settings = {}) {
  const currency = settings.currency || 'GHS';
  const items    = sale.items ?? [];
  const total    = Number(sale.grand_total || 0);
  const totalQty = items.reduce((s, i) => s + Number(i.quantity), 0);

  const fmt = (n) => Number(n).toFixed(2);

  const itemRows = items.map((item) => `
    <tr>
      <td class="name">${escHtml(item.product_name ?? '')}</td>
      <td class="num">${fmt(item.quantity)}</td>
      <td class="num">${fmt(item.unit_price)}</td>
      <td class="num bold">${fmt(item.subtotal)}</td>
    </tr>
  `).join('');

  const logoHtml = settings.logo_url
    ? `<img class="logo" src="${escHtml(settings.logo_url)}" alt="logo" />`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt ${escHtml(sale.receipt_number)}</title>
  <style>
    /* ── Page setup for 80mm thermal paper ── */
    @page {
      size: 80mm auto;
      margin: 3mm 4mm;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      width: 72mm;           /* 80mm - 4mm margins each side */
      font-family: 'Courier New', Courier, monospace;
      font-size: 9.5pt;
      color: #000;
      background: #fff;
    }

    /* ── Logo ── */
    .logo {
      display: block;
      max-width: 28mm;
      max-height: 18mm;
      margin: 0 auto 3mm;
      object-fit: contain;
    }

    /* ── Header ── */
    .center   { text-align: center; }
    .shop-name {
      font-size: 13pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 1mm;
    }
    .sub {
      font-size: 8pt;
      text-align: center;
      line-height: 1.45;
    }
    .header-note {
      font-size: 8pt;
      font-style: italic;
      text-align: center;
      margin-top: 1.5mm;
    }

    /* ── Dividers ── */
    .solid  { border-top: 1px solid #000; margin: 2.5mm 0; }
    .dashed { border-top: 1px dashed #000; margin: 2.5mm 0; }

    /* ── Title ── */
    .receipt-title {
      text-align: center;
      font-size: 10pt;
      font-weight: bold;
      letter-spacing: 0.05em;
      margin-bottom: 1mm;
    }

    /* ── Meta (receipt #, date, cashier) ── */
    .meta-table {
      width: 100%;
      font-size: 8.5pt;
      border-collapse: collapse;
    }
    .meta-table td { padding: 0.6mm 0; }
    .meta-table .label { font-weight: bold; width: 22mm; }

    /* ── Items table ── */
    .items {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }
    .items th {
      font-weight: bold;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 1mm 0;
    }
    .items td {
      padding: 1mm 0;
      vertical-align: top;
    }
    .items tr + tr td { border-top: none; }
    .name { width: 38mm; word-break: break-word; }
    .num  { text-align: right; }
    .bold { font-weight: bold; }

    /* ── Count line ── */
    .count-line {
      font-size: 8pt;
      margin-bottom: 2mm;
    }

    /* ── Total box ── */
    .total-box {
      border: 1.5px solid #000;
      padding: 2mm 2.5mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2.5mm;
    }
    .total-label { font-size: 10pt; font-weight: bold; }
    .total-amount { font-size: 10pt; font-weight: bold; }

    /* ── Footer ── */
    .footer { font-size: 8pt; text-align: center; line-height: 1.6; margin-top: 1mm; }
    .footer .italic { font-style: italic; }
    .footer .stars  { font-size: 7.5pt; }
  </style>
</head>
<body>

  ${logoHtml}

  ${settings.shop_name ? `<div class="shop-name">${escHtml(settings.shop_name)}</div>` : ''}
  <div class="sub">
    ${settings.shop_address ? escHtml(settings.shop_address) + '<br/>' : ''}
    ${[settings.phone_number, settings.phone_number_2].filter(Boolean).map(p => 'Tel: ' + escHtml(p)).join('<br/>')}
  </div>
  ${settings.receipt_header ? `<div class="header-note">${escHtml(settings.receipt_header)}</div>` : ''}

  <div class="solid"></div>

  <div class="receipt-title">SALES RECEIPT</div>

  <div class="dashed"></div>

  <table class="meta-table">
    <tr><td class="label">Receipt #</td><td>${escHtml(sale.receipt_number)}</td></tr>
    <tr><td class="label">Date</td><td>${escHtml(formatDateTime(sale.created_at))}</td></tr>
    <tr><td class="label">Cashier</td><td>${escHtml(sale.cashier_name ?? '')}</td></tr>
  </table>

  <div class="dashed"></div>

  <table class="items">
    <thead>
      <tr>
        <th class="name">ITEM</th>
        <th class="num">QTY</th>
        <th class="num">PRICE</th>
        <th class="num">AMT</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="solid"></div>

  <div class="count-line">${items.length} item(s) &mdash; ${totalQty.toFixed(2)} units</div>

  <div class="total-box">
    <span class="total-label">TOTAL</span>
    <span class="total-amount">${escHtml(currency)} ${fmt(total)}</span>
  </div>

  ${sale.amount_tendered != null ? `
  <table class="meta-table" style="margin-bottom:2mm;">
    <tr>
      <td class="label">Cash Tendered</td>
      <td style="text-align:right">${escHtml(currency)} ${fmt(Number(sale.amount_tendered))}</td>
    </tr>
    <tr>
      <td class="label" style="font-weight:bold">Change</td>
      <td style="text-align:right;font-weight:bold">${escHtml(currency)} ${fmt(Number(sale.change_due ?? Math.max(0, Number(sale.amount_tendered) - total)))}</td>
    </tr>
  </table>` : ''}

  <div class="dashed"></div>

  <div class="footer">
    ${settings.receipt_footer ? `<div class="italic">${escHtml(settings.receipt_footer)}</div>` : ''}
    <div>Thank you for your business!</div>
    <div class="stars">*** Please come again ***</div>
  </div>

</body>
</html>`;

  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
    return;
  }
  win.document.write(html);
  win.document.close();

  // Wait for images (logo) to load before printing
  win.onload = () => {
    win.focus();
    win.print();
    // Close the helper window after the print dialog is dismissed
    win.onafterprint = () => win.close();
  };
}

/** Escape HTML special characters to prevent XSS in the receipt window. */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
