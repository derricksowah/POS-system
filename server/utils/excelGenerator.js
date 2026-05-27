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
async function generateInventoryReportExcel(res, { dateRange, rows, currency = 'GHS', visibleColumns } = {}) {
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
  ws.getCell('A2').value = `Period: ${dateRange?.from || 'today'} to ${dateRange?.to || dateRange?.from || 'today'} | Generated: ${new Date().toLocaleString()}`;
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.getCell('A2').font = { size: 9, color: { argb: 'FF64748B' } };

  ws.addRow([]);

  // Default: show all columns if not specified
  const showCol = (key) => !visibleColumns || visibleColumns.includes(key);

  // Dynamic column definitions based on visibility
  const allCols = [
    { key: 'no',        label: '#',                          width: 6  },
    { key: 'code',      label: 'Product Code',               width: 14 },
    { key: 'name',      label: 'Product Name',               width: 32 },
    { key: 'unit',      label: 'Unit',                       width: 10 },
    { key: 'opening',   label: 'Opening Balance',            width: 18 },
    { key: 'purchased', label: 'Purchases / In',             width: 16 },
    { key: 'sold',      label: 'Sales / Out',                width: 14 },
    { key: 'closing',   label: 'Closing Stock',              width: 16 },
    { key: 'value',     label: `Closing Value (${currency})`, width: 18 },
    { key: 'status',    label: 'Status',                     width: 16 },
  ];

  const visibleCols = allCols.filter((col) => showCol(col.key));
  ws.columns = visibleCols;

  // Header row
  const headerRow = ws.addRow(visibleCols.map((col) => col.label));
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
    const rowData = {};
    if (showCol('no')) rowData.no = i + 1;
    if (showCol('code')) rowData.code = row.code;
    if (showCol('name')) rowData.name = row.name;
    if (showCol('unit')) rowData.unit = row.unit;
    if (showCol('opening')) rowData.opening = Number(row.opening);
    if (showCol('purchased')) rowData.purchased = Number(row.purchased);
    if (showCol('sold')) rowData.sold = Number(row.sold);
    if (showCol('closing')) rowData.closing = closing;
    if (showCol('value')) rowData.value = Number(row.closing_value);
    if (showCol('status')) rowData.status = row.status;

    const r = ws.addRow(rowData);

    // Alternate row shading
    if (i % 2 === 1) {
      visibleCols.forEach((col) => {
        r.getCell(col.key).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    // Closing stock colour
    if (showCol('closing')) {
      const closingCell = r.getCell('closing');
      closingCell.font = {
        bold: true,
        color: { argb: closing < 0 ? 'FFB91C1C' : closing === 0 ? 'FFB91C1C' : closing <= Number(row.threshold) ? 'FFD97706' : 'FF15803D' },
      };
    }

    // Status badge colour
    if (showCol('status')) {
      const fill = statusFill[row.status];
      if (fill) r.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: fill };
      r.getCell('status').font = { bold: true };
    }

    // Number alignment and formatting
    ['opening','purchased','sold','closing'].forEach((k) => {
      if (showCol(k)) {
        r.getCell(k).alignment = { horizontal: 'right' };
        r.getCell(k).numFmt = '#,##0.00';
      }
    });
    if (showCol('value')) {
      r.getCell('value').alignment = { horizontal: 'right' };
      r.getCell('value').numFmt = moneyFmt;
    }

    if (showCol('opening')) totOpen += Number(row.opening);
    if (showCol('purchased')) totPur += Number(row.purchased);
    if (showCol('sold')) totSold += Number(row.sold);
    if (showCol('closing')) totClose += closing;
    if (showCol('value')) totValue += Number(row.closing_value);
  });

  // Totals row
  ws.addRow([]);
  const totalData = {};
  if (showCol('no')) totalData.no = '';
  if (showCol('code')) totalData.code = '';
  if (showCol('name')) totalData.name = 'TOTALS';
  if (showCol('unit')) totalData.unit = '';
  if (showCol('opening')) totalData.opening = totOpen;
  if (showCol('purchased')) totalData.purchased = totPur;
  if (showCol('sold')) totalData.sold = totSold;
  if (showCol('closing')) totalData.closing = totClose;
  if (showCol('value')) totalData.value = totValue;
  if (showCol('status')) totalData.status = '';

  const totalRow = ws.addRow(totalData);
  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  ['opening','purchased','sold','closing'].forEach((k) => {
    if (showCol(k)) {
      totalRow.getCell(k).numFmt = '#,##0.00';
      totalRow.getCell(k).alignment = { horizontal: 'right' };
    }
  });
  if (showCol('value')) {
    totalRow.getCell('value').numFmt = moneyFmt;
    totalRow.getCell('value').alignment = { horizontal: 'right' };
  }

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

async function generateProductCatalogExcel(res, { title, rows, currency = 'GHS' }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'POS System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Product Catalog');
  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = title;
  ws.getCell('A1').font = { size: 14, bold: true };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.addRow([]);
  ws.columns = [
    { key: 'code', width: 14 },
    { key: 'name', width: 40 },
    { key: 'unit', width: 14 },
    { key: 'price', width: 14 },
    { key: 'stock', width: 12 },
    { key: 'status', width: 14 },
  ];

  const header = ws.addRow(['Code', 'Name', 'Unit', `Price (${currency})`, 'Stock', 'Status']);
  header.font = { bold: true };
  header.alignment = { horizontal: 'center' };

  rows.forEach((r, i) => {
    const row = ws.addRow({ code: r.code, name: r.name, unit: r.unit, price: Number(r.price), stock: Number(r.current_stock), status: r.is_active ? 'Active' : 'Inactive' });
    if (i % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    row.getCell('price').numFmt = `"${currency}" #,##0.00`;
    row.getCell('stock').numFmt = '#,##0.00';
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="product-catalog.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}

async function generateProfitabilityReportExcel(res, { title, rows, dateRange, currency = 'GHS' }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'POS System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Profitability Report');
  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = title;
  ws.getCell('A1').font = { size: 14, bold: true };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2:G2');
  ws.getCell('A2').value = `Period: ${dateRange.from} to ${dateRange.to} | Generated: ${new Date().toLocaleString()}`;
  ws.getCell('A2').alignment = { horizontal: 'center' };

  ws.addRow([]);
  ws.columns = [
    { key: 'code', width: 12 },
    { key: 'name', width: 36 },
    { key: 'price', width: 14 },
    { key: 'cost', width: 14 },
    { key: 'margin', width: 14 },
    { key: 'qty', width: 12 },
    { key: 'profit', width: 16 },
  ];

  const header = ws.addRow(['Code', 'Product Name', `Sell (${currency})`, `Cost (${currency})`, 'Margin', 'Qty Sold', `Profit (${currency})`]);
  header.font = { bold: true };
  header.alignment = { horizontal: 'center' };

  rows.forEach((r, i) => {
    const row = ws.addRow({ code: r.product_id ? `P${r.product_id}` : '', name: r.product_name, price: Number(r.selling_price ?? 0), cost: Number(r.cost_price ?? 0), margin: Number(r.margin ?? 0), qty: Number(r.quantity_sold ?? 0), profit: Number(r.profit ?? 0) });
    if (i % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    ['price', 'cost', 'margin', 'profit'].forEach((k) => { row.getCell(k).numFmt = `"${currency}" #,##0.00`; });
    row.getCell('qty').numFmt = '#,##0.00';
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="profitability-report.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}

module.exports = { generateSalesReportExcel, generateInventoryReportExcel, generateProductCatalogExcel, generateProfitabilityReportExcel };
