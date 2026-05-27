const reportService = require('../services/reportService');
const { generateSalesReportPDF, generateInventoryReportPDF } = require('../utils/pdfGenerator');
const { generateSalesReportExcel, generateInventoryReportExcel } = require('../utils/excelGenerator');
const { generateProfitabilityReportPDF } = require('../utils/pdfGenerator');
const { generateProfitabilityReportExcel } = require('../utils/excelGenerator');
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
    const { from, to, search } = req.query;
    const { format } = req.params;
    const data = await reportService.getSalesReport({ from, to, search });
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
    const { from, to, product_ids, columns } = req.query;
    const { format } = req.params;
    const data = await reportService.getInventoryReport({ from, to, product_ids });
    const settings = await settingsService.getSettings();
    const currency = settings?.currency || 'GHS';
    const visibleColumns = columns ? columns.split(',').filter(c => c) : undefined;

    if (format === 'pdf') {
      return generateInventoryReportPDF(res, {
        title: `${settings?.shop_name || 'POS'} — Inventory Report`,
        dateRange: data.period,
        rows: data.rows,
        currency,
        visibleColumns,
      });
    }

    if (format === 'excel') {
      return generateInventoryReportExcel(res, { dateRange: data.period, rows: data.rows, currency, visibleColumns });
    }

    res.json(data);
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

async function profitabilityReport(req, res, next) {
  try {
    const { format } = req.params || {};
    const data = await reportService.getProfitabilityReport(req.query);
    const settings = await settingsService.getSettings();
    const currency = settings?.currency || 'GHS';
    if (format === 'pdf') return generateProfitabilityReportPDF(res, { title: `${settings?.shop_name || 'POS'} — Profitability Report`, rows: data.rows, dateRange: data.period, currency });
    if (format === 'excel') return generateProfitabilityReportExcel(res, { title: `${settings?.shop_name || 'POS'} — Profitability Report`, rows: data.rows, dateRange: data.period, currency });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard, salesReport, inventoryReport, todaySummary, dailyTrend, profitabilityReport };
