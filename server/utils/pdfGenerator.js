/**
 * PDF generation utilities.
 * Uses pdfkit for report generation.
 */
const PDFDocument = require('pdfkit');

/**
 * Generate a Sales Report PDF and pipe to response stream.
 */
function generateSalesReportPDF(res, { title, dateRange, rows, totals, currency }) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="sales-report.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.fontSize(10).font('Helvetica').text(
    `Period: ${dateRange.from} to ${dateRange.to}`, { align: 'center' }
  );
  doc.fontSize(9).text(
    `Generated: ${new Date().toLocaleString()} | Transactions: ${totals.transaction_count} | Lines: ${totals.line_count}`,
    { align: 'center' }
  );
  doc.moveDown(1);

  // Column positions
  const cols = { code: 40, name: 95, qty: 270, price: 340, amount: 430 };
  const rowH = 18;
  let y = doc.y;

  // Table header background
  doc.rect(40, y - 3, 520, rowH).fill('#1e3a5f');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
  doc.text('Code',              cols.code,  y, { width: 50 });
  doc.text('Product Name',      cols.name,  y, { width: 170 });
  doc.text('Qty',               cols.qty,   y, { width: 65, align: 'right' });
  doc.text(`Unit Price`,        cols.price, y, { width: 85, align: 'right' });
  doc.text(`Amount (${currency})`, cols.amount, y, { width: 90, align: 'right' });
  y += rowH;
  doc.fillColor('#000000');

  // Rows
  doc.font('Helvetica').fontSize(8.5);
  let shade = false;
  for (const row of rows) {
    if (y > 730) {
      doc.addPage();
      y = 40;
      shade = false;
    }
    if (shade) doc.rect(40, y - 2, 520, rowH).fill('#f8fafc').stroke('#f8fafc');
    doc.fillColor('#000000');
    doc.text(row.product_code,              cols.code,   y, { width: 50 });
    doc.text(row.product_name,              cols.name,   y, { width: 170, ellipsis: true });
    doc.text(Number(row.quantity).toFixed(2),  cols.qty, y, { width: 65, align: 'right' });
    doc.text(fmt(row.unit_price, currency), cols.price,  y, { width: 85, align: 'right' });
    doc.text(fmt(row.amount, currency),     cols.amount, y, { width: 90, align: 'right' });
    y += rowH;
    shade = !shade;
  }

  // Footer totals
  doc.moveTo(40, y).lineTo(560, y).lineWidth(0.5).stroke('#1e3a5f');
  y += 6;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text(`Total Qty: ${Number(totals.total_qty).toFixed(2)}`, cols.name, y);
  doc.text(`Grand Total:`, cols.price, y, { width: 85, align: 'right' });
  doc.text(fmt(totals.grand_total, currency), cols.amount, y, { width: 90, align: 'right' });

  doc.end();
}

/**
 * Generate an Inventory Report PDF.
 */
function generateInventoryReportPDF(res, { title, rows }) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="inventory-report.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(1);

  // Column positions (landscape A4 = 841 wide)
  const cols = { no: 30, code: 55, name: 110, open: 310, pur: 400, sold: 490, close: 580, status: 670 };
  const rowH = 18;
  let y = doc.y;

  // Header row background
  doc.rect(30, y - 3, 780, rowH).fill('#1e3a5f');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
  doc.text('#',                  cols.no,    y, { width: 22 });
  doc.text('Product Code',       cols.code,  y, { width: 52 });
  doc.text('Product Name',       cols.name,  y, { width: 195 });
  doc.text('Opening Balance',    cols.open,  y, { width: 85, align: 'right' });
  doc.text('Purchases / In',     cols.pur,   y, { width: 85, align: 'right' });
  doc.text('Sales / Out',        cols.sold,  y, { width: 85, align: 'right' });
  doc.text('Closing Stock',      cols.close, y, { width: 85, align: 'right' });
  doc.text('Status',             cols.status,y, { width: 70 });
  y += rowH;
  doc.fillColor('#000000');

  // Data rows
  doc.font('Helvetica').fontSize(8.5);
  let shade = false;
  let totOpen = 0, totPur = 0, totSold = 0, totClose = 0;

  rows.forEach((row, i) => {
    if (y > 540) { doc.addPage({ layout: 'landscape' }); y = 40; shade = false; }
    if (shade) doc.rect(30, y - 2, 780, rowH).fill('#f8fafc').stroke('#f8fafc');
    doc.fillColor('#000000');

    const closing = Number(row.closing);
    doc.text(String(i + 1),                     cols.no,    y, { width: 22 });
    doc.text(row.code,                           cols.code,  y, { width: 52 });
    doc.text(row.name,                           cols.name,  y, { width: 195, ellipsis: true });
    doc.text(Number(row.opening).toFixed(2),     cols.open,  y, { width: 85, align: 'right' });
    doc.text(Number(row.purchased).toFixed(2),   cols.pur,   y, { width: 85, align: 'right' });
    doc.text(Number(row.sold).toFixed(2),        cols.sold,  y, { width: 85, align: 'right' });

    // Colour closing stock
    const closingColor = closing < 0 ? '#b91c1c' : closing === 0 ? '#b91c1c' : '#15803d';
    doc.fillColor(closingColor);
    doc.text(closing.toFixed(2),                 cols.close, y, { width: 85, align: 'right' });
    doc.fillColor('#000000');
    doc.text(row.status,                         cols.status,y, { width: 70 });

    totOpen  += Number(row.opening);
    totPur   += Number(row.purchased);
    totSold  += Number(row.sold);
    totClose += closing;
    y += rowH;
    shade = !shade;
  });

  // Totals footer
  doc.moveTo(30, y).lineTo(810, y).lineWidth(0.5).stroke('#1e3a5f');
  y += 5;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
  doc.text('TOTALS',                  cols.name,  y, { width: 195 });
  doc.text(totOpen.toFixed(2),        cols.open,  y, { width: 85, align: 'right' });
  doc.text(totPur.toFixed(2),         cols.pur,   y, { width: 85, align: 'right' });
  doc.text(totSold.toFixed(2),        cols.sold,  y, { width: 85, align: 'right' });
  doc.text(totClose.toFixed(2),       cols.close, y, { width: 85, align: 'right' });

  doc.end();
}

function fmt(val, currency) {
  return `${currency} ${Number(val).toFixed(2)}`;
}

module.exports = { generateSalesReportPDF, generateInventoryReportPDF };
