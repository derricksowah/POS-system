const printService  = require('../services/printService');
const salesService  = require('../services/salesService');
const settingsService = require('../services/settingsService');

/**
 * POST /api/print/receipt
 * Body: { sale_id }
 * Fetches the full sale + current settings, then prints directly to the thermal printer.
 */
async function printReceipt(req, res, next) {
  try {
    const { sale_id } = req.body;
    if (!sale_id) return res.status(400).json({ error: 'sale_id is required.' });

    const [sale, settings] = await Promise.all([
      salesService.getSaleById(sale_id),
      settingsService.getSettings(),
    ]);

    if (!sale) return res.status(404).json({ error: 'Sale not found.' });

    console.log('[PRINT] Settings printer_name:', settings?.printer_name);
    console.log('[PRINT] Attempting to print receipt', sale_id);

    // Attach cashier name (already on sale from getSaleById)
    await printService.printReceipt(sale, settings || {});

    console.log('[PRINT] Receipt printed successfully');
    res.json({ success: true, message: 'Receipt printed.' });
  } catch (err) {
    console.error('[PRINT] Error:', err.message);
    next(err);
  }
}

/**
 * GET /api/print/printers
 * Returns a list of printer names visible to Windows.
 * Use this to find the correct PRINTER_NAME to set in .env
 */
async function listPrinters(req, res, next) {
  try {
    const printers = await printService.listPrinters();
    const configured = process.env.PRINTER_NAME || null;
    res.json({ printers, configured });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/print/status
 * Returns whether the configured printer is reachable.
 */
async function printerStatus(req, res, next) {
  try {
    const ready       = await printService.isPrinterReady();
    const configured  = process.env.PRINTER_NAME || null;
    res.json({ ready, configured });
  } catch (err) {
    next(err);
  }
}

module.exports = { printReceipt, listPrinters, printerStatus };
