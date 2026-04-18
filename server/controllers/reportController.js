const reportService = require('../services/reportService');
const { generateSalesReportPDF, generateInventoryReportPDF } = require('../utils/pdfGenerator');
const { generateSalesReportExcel, generateInventoryReportExcel } = require('../utils/excelGenerator');
const settingsService = require('../services/settingsService');

async function dashboard(req, res, next) {
  try {
    const data = await reportService.getDashboard();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function salesReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const { format } = req.params;
    const data = await reportService.getSalesReport({ from, to });
    const settings = await settingsService.getSettings();
    const currency = settings?.currency || 'GHS';

    if (format === 'pdf') {
      return generateSalesReportPDF(res, {
        title:     `${settings?.shop_name || 'POS'} — Sales Report`,
        dateRange: { from: data.period.from, to: data.period.to },
        rows:      data.rows,
        totals:    data.totals,
        currency,
      });
    }

    if (format === 'excel') {
      return generateSalesReportExcel(res, {
        title:     `${settings?.shop_name || 'POS'} — Sales Report`,
        dateRange: { from: data.period.from, to: data.period.to },
        rows:      data.rows,
        totals:    data.totals,
        currency,
      });
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function inventoryReport(req, res, next) {
  try {
    const { format } = req.params;
    const rows = await reportService.getInventoryReport();
    const settings = await settingsService.getSettings();
    const currency = settings?.currency || 'GHS';

    if (format === 'pdf') {
      return generateInventoryReportPDF(res, {
        title: `${settings?.shop_name || 'POS'} — Inventory Report`,
        rows,
        currency,
      });
    }

    if (format === 'excel') {
      return generateInventoryReportExcel(res, { rows, currency });
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function todaySummary(req, res, next) {
  try {
    const data = await reportService.getTodaySalesSummary(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function dailyTrend(req, res, next) {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const data = await reportService.getDailyTrend(days);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard, salesReport, inventoryReport, todaySummary, dailyTrend };
