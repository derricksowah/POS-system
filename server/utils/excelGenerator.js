/**
 * Excel generation utilities using ExcelJS.
 */
const ExcelJS = require('exceljs');

/**
 * Generate a Sales Report Excel file.
 */
async function generateSalesReportExcel(res, { title, dateRange, rows, totals, currency }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'POS System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Sales Report');

  // Title rows
  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = title;
  ws.getCell('A1').font = { size: 14, bold: true };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2:G2');
  ws.getCell('A2').value = `Period: ${dateRange.from} to ${dateRange.to}`;
  ws.getCell('A2').alignment = { horizontal: 'center' };

  ws.mergeCells('A3:G3');
  ws.getCell('A3').value = `Transactions: ${totals.transaction_count}  |  Generated: ${new Date().toLocaleString()}`;
  ws.getCell('A3').alignment = { horizontal: 'center' };
  ws.getCell('A3').font = { size: 9, color: { argb: 'FF64748B' } };

  // Column definitions
  ws.columns = [
    { key: 'receipt',    width: 20 },
    { key: 'date',       width: 20 },
    { key: 'code',       width: 14 },
    { key: 'name',       width: 32 },
    { key: 'qty',        width: 12 },
    { key: 'unit_price', width: 18 },
    { key: 'amount',     width: 18 },
  ];

  // Header row
  ws.addRow([]);
  const headerRow = ws.addRow([
    'Receipt #', 'Date & Time', 'Product Code', 'Product Name',
    'Qty Sold', `Unit Price (${currency})`, `Amount (${currency})`,
  ]);
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { horizontal: 'center' };

  const numFmt = `"${currency}" #,##0.00`;

  // Data rows (alternate shading)
  rows.forEach((row, i) => {
    const r = ws.addRow({
      receipt:    row.receipt_number,
      date:       new Date(row.created_at).toLocaleString(),
      code:       row.product_code,
      name:       row.product_name,
      qty:        Number(row.quantity),
      unit_price: Number(row.unit_price),
      amount:     Number(row.amount),
    });
    if (i % 2 === 1) {
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
    r.getCell('unit_price').numFmt = numFmt;
    r.getCell('amount').numFmt     = numFmt;
  });

  // Totals row
  ws.addRow([]);
  const totalRow = ws.addRow([
    '', '', '', 'TOTALS',
    Number(totals.total_qty).toFixed(2), '',
    Number(totals.grand_total),
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell('amount').numFmt = numFmt;
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

  // Borders from header row down
  ws.eachRow((row, rowNumber) => {
    if (rowNumber >= 5) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    }
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="sales-report.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}

/**
 * Generate an Inventory Report Excel file.
 */
async function generateInventoryReportExcel(res, { rows, currency = 'GHS' }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'POS System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Inventory Report');

  // Title
  ws.mergeCells('A1:J1');
  ws.getCell('A1').value = 'Inventory Report';
  ws.getCell('A1').font = { size: 14, bold: true };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2:J2');
  ws.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.getCell('A2').font = { size: 9, color: { argb: 'FF64748B' } };

  ws.addRow([]);

  // Column definitions
  ws.columns = [
    { key: 'no',        width: 6  },
    { key: 'code',      width: 14 },
    { key: 'name',      width: 32 },
    { key: 'unit',      width: 10 },
    { key: 'opening',   width: 18 },
    { key: 'purchased', width: 16 },
    { key: 'sold',      width: 14 },
    { key: 'closing',   width: 16 },
    { key: 'value',     width: 18 },
    { key: 'status',    width: 16 },
  ];

  // Header row
  const headerRow = ws.addRow(['#', 'Product Code', 'Product Name', 'Unit', 'Opening Balance', 'Purchases / In', 'Sales / Out', 'Closing Stock', `Closing Value (${currency})`, 'Status']);
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { horizontal: 'center' };

  const statusFill = {
    'OK':            { argb: 'FFD1FAE5' },
    'Low':           { argb: 'FFFEF3C7' },
    'Zero':          { argb: 'FFFEE2E2' },
    'Negative':      { argb: 'FFFEE2E2' },
    'Zero Movement': { argb: 'FFE0E7FF' },
  };

  let totOpen = 0, totPur = 0, totSold = 0, totClose = 0, totValue = 0;
  const moneyFmt = `"${currency}" #,##0.00`;

  rows.forEach((row, i) => {
    const closing = Number(row.closing);
    const r = ws.addRow({
      no:        i + 1,
      code:      row.code,
      name:      row.name,
      unit:      row.unit,
      opening:   Number(row.opening),
      purchased: Number(row.purchased),
      sold:      Number(row.sold),
      closing,
      value:     Number(row.closing_value),
      status:    row.status,
    });

    // Alternate row shading
    if (i % 2 === 1) {
      ['no','code','name','unit','opening','purchased','sold','closing','value'].forEach((k) => {
        r.getCell(k).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    // Closing stock colour
    const closingCell = r.getCell('closing');
    closingCell.font = {
      bold: true,
      color: { argb: closing < 0 ? 'FFB91C1C' : closing === 0 ? 'FFB91C1C' : closing <= Number(row.threshold) ? 'FFD97706' : 'FF15803D' },
    };

    // Status badge colour
    const fill = statusFill[row.status];
    if (fill) r.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: fill };
    r.getCell('status').font = { bold: true };

    // Number alignment
    ['opening','purchased','sold','closing'].forEach((k) => {
      r.getCell(k).alignment = { horizontal: 'right' };
      r.getCell(k).numFmt = '#,##0.00';
    });
    r.getCell('value').alignment = { horizontal: 'right' };
    r.getCell('value').numFmt = moneyFmt;

    totOpen  += Number(row.opening);
    totPur   += Number(row.purchased);
    totSold  += Number(row.sold);
    totClose += closing;
    totValue += Number(row.closing_value);
  });

  // Totals row
  ws.addRow([]);
  const totalRow = ws.addRow(['', '', 'TOTALS', '', totOpen, totPur, totSold, totClose, totValue, '']);
  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  ['opening','purchased','sold','closing'].forEach((k) => {
    totalRow.getCell(k).numFmt = '#,##0.00';
    totalRow.getCell(k).alignment = { horizontal: 'right' };
  });
  totalRow.getCell('value').numFmt = moneyFmt;
  totalRow.getCell('value').alignment = { horizontal: 'right' };

  // Borders from header row down
  ws.eachRow((row, rowNumber) => {
    if (rowNumber >= 4) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    }
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="inventory-report.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}

module.exports = { generateSalesReportExcel, generateInventoryReportExcel };
