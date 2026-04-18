'use strict';
/**
 * printService.js
 *
 * Windows-compatible thermal receipt printer service.
 *
 * Strategy: node-thermal-printer builds the ESC/POS byte buffer in memory.
 * We then send that raw buffer directly to the Windows print spooler via
 * PowerShell's [System.Drawing.Printing] RawPrinterHelper or, more simply,
 * by writing to a temp file and calling "copy /b file \\.\printerName" which
 * is the classic Windows approach that bypasses the GDI driver completely and
 * sends raw bytes to the printer queue.  No native Node addon needed.
 */

const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer');
const { query } = require('../config/database');
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/* ─── helpers ──────────────────────────────────────────────────────────────── */

async function getPrinterName() {
  try {
    const res = await query('SELECT printer_name FROM settings LIMIT 1');
    const dbName = res.rows[0]?.printer_name?.trim();
    if (dbName) return dbName;
  } catch { }
  return process.env.PRINTER_NAME || '';
}

/**
 * List available Windows printers via PowerShell (works on Windows 10/11).
 */
async function listPrinters() {
  return new Promise((resolve) => {
    try {
      const out = execSync(
        'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
        { encoding: 'utf8', timeout: 8000 }
      );
      const names = out
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      resolve(names);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Check whether the named printer exists and is not offline/error.
 */
async function isPrinterReady() {
  const name = await getPrinterName();
  if (!name) return false;
  try {
    const out = execSync(
      `powershell -NoProfile -Command "(Get-Printer -Name '${name.replace(/'/g, "''")}').PrinterStatus"`,
      { encoding: 'utf8', timeout: 6000 }
    ).trim();
    // PrinterStatus == 'Normal' means ready
    return out === 'Normal';
  } catch {
    return false;
  }
}

/**
 * Send a raw byte buffer to a Windows printer via PowerShell + .NET
 * System.Drawing.Printing.  This avoids all native addon requirements.
 *
 * @param {Buffer} buffer
 * @param {string} printerName  - exact Windows printer name
 */
async function sendRawToPrinter(buffer, printerName) {
  console.log('[sendRawToPrinter] Sending to printer:', printerName);
  console.log('[sendRawToPrinter] Buffer size:', buffer.length, 'bytes');

  // Write ESC/POS bytes to a temp file
  const tmpFile = path.join(os.tmpdir(), `receipt_${Date.now()}.bin`);
  fs.writeFileSync(tmpFile, buffer);
  console.log('[sendRawToPrinter] Temp file created:', tmpFile);

  // PowerShell script that uses .NET to print raw bytes
  const ps = `
$printerName = '${printerName.replace(/'/g, "''")}'
$file        = '${tmpFile.replace(/\\/g, '\\\\')}'

Add-Type -AssemblyName System.Drawing

$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = $printerName

if (-not $pd.PrinterSettings.IsValid) {
  throw "Printer '$printerName' not found or invalid."
}

# Use P/Invoke to send raw bytes
$signature = @'
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [DllImport("winspool.drv", EntryPoint="OpenPrinterA", SetLastError=true)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
  [DllImport("winspool.drv", EntryPoint="ClosePrinter", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", SetLastError=true)]
  public static extern int StartDocPrinter(IntPtr hPrinter, int Level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.drv", EntryPoint="EndDocPrinter", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint="StartPagePrinter", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint="EndPagePrinter", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  [StructLayout(LayoutKind.Sequential)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  public static bool SendFileToPrinter(string printerName, string fileName) {
    IntPtr lhPrinter;
    if (!OpenPrinter(printerName, out lhPrinter, IntPtr.Zero)) return false;
    var di = new DOCINFOA { pDocName = "Receipt", pDataType = "RAW" };
    if (StartDocPrinter(lhPrinter, 1, di) == 0) { ClosePrinter(lhPrinter); return false; }
    StartPagePrinter(lhPrinter);
    byte[] bytes = System.IO.File.ReadAllBytes(fileName);
    IntPtr buf = Marshal.AllocCoTaskMem(bytes.Length);
    Marshal.Copy(bytes, 0, buf, bytes.Length);
    int written;
    WritePrinter(lhPrinter, buf, bytes.Length, out written);
    Marshal.FreeCoTaskMem(buf);
    EndPagePrinter(lhPrinter);
    EndDocPrinter(lhPrinter);
    ClosePrinter(lhPrinter);
    return written == bytes.Length;
  }
}
'@
Add-Type -TypeDefinition $signature -Language CSharp

$result = [RawPrinter]::SendFileToPrinter($printerName, $file)
if (-not $result) { throw "SendFileToPrinter returned false." }
Write-Output "OK"
`;

  const psFile = path.join(os.tmpdir(), `print_${Date.now()}.ps1`);
  fs.writeFileSync(psFile, ps, 'utf8');

  try {
    const result = spawnSync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile
    ], { encoding: 'utf8', timeout: 15000 });

    const stdout = (result.stdout || '').trim();
    const stderr = (result.stderr || '').trim();

    console.log('[sendRawToPrinter] PowerShell exit code:', result.status);
    console.log('[sendRawToPrinter] PowerShell stdout:', stdout);
    if (stderr) console.log('[sendRawToPrinter] PowerShell stderr:', stderr);

    if (result.status !== 0 || !stdout.includes('OK')) {
      throw new Error(stderr || stdout || 'PowerShell print failed');
    }
    console.log('[sendRawToPrinter] Print completed successfully');
  } finally {
    // Clean up temp files
    try { fs.unlinkSync(tmpFile); } catch { }
    try { fs.unlinkSync(psFile); } catch { }
  }
}

/* ─── main print function ───────────────────────────────────────────────────── */

/**
 * Print a receipt to the configured thermal printer.
 * @param {object} sale     - sale record with items, receipt_number, etc.
 * @param {object} settings - shop settings (name, address, etc.)
 */
async function printReceipt(sale, settings = {}) {
  const name = await getPrinterName();
  console.log('[printService] Printer name retrieved:', name);

  if (!name) {
    throw Object.assign(
      new Error('No printer configured. Set PRINTER_NAME in server/.env or via Admin → Settings.'),
      { status: 503, expose: true }
    );
  }

  console.log('[printService] Checking printer ready status...');
  const ready = await isPrinterReady();
  console.log('[printService] Printer ready:', ready);

  if (!ready) {
    throw Object.assign(
      new Error(`Printer "${name}" is not connected or not ready.`),
      { status: 503, expose: true }
    );
  }

  // Build ESC/POS buffer with node-thermal-printer (network interface = localhost
  // is a trick to get the buffer without needing a real interface connection)
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'tcp://localhost:9100', // interface is irrelevant — we won't call execute()
    characterSet: CharacterSet.PC437_USA,
    removeSpecialCharacters: true,
    lineCharacter: '-',
    width: 42,
  });

  const currency = settings.currency || 'GHS';
  const items = sale.items ?? [];
  const total = Number(sale.grand_total || 0);
  const totalQty = items.reduce((s, i) => s + Number(i.quantity), 0);
  const fmt = (n) => Number(n).toFixed(2);
  const LINE = '-'.repeat(42);
  const DASH = '-'.repeat(42);

  // ── HEADER ─────────────────────────────────────────────────────────────────
  printer.alignCenter();
  if (settings.shop_name) {
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(settings.shop_name);
    printer.bold(false);
    printer.setTextNormal();
  }
  if (settings.shop_address) printer.println(settings.shop_address);
  if (settings.phone_number) printer.println(`Tel: ${settings.phone_number}`);
  if (settings.phone_number_2) printer.println(`Tel: ${settings.phone_number_2}`);
  if (settings.receipt_header) {
    printer.newLine();
    printer.println(settings.receipt_header);
  }
  printer.newLine();
  printer.println(LINE);

  // ── TITLE ──────────────────────────────────────────────────────────────────
  printer.bold(true);
  printer.println('SALES RECEIPT');
  printer.bold(false);
  printer.println(DASH);

  // ── META ───────────────────────────────────────────────────────────────────
  printer.alignLeft();
  printer.tableCustom([
    { text: 'Receipt #', align: 'LEFT', width: 0.4, bold: true },
    { text: String(sale.receipt_number), align: 'RIGHT', width: 0.6 },
  ]);
  printer.tableCustom([
    { text: 'Date', align: 'LEFT', width: 0.4, bold: true },
    { text: formatDate(sale.created_at), align: 'RIGHT', width: 0.6 },
  ]);
  printer.tableCustom([
    { text: 'Cashier', align: 'LEFT', width: 0.4, bold: true },
    { text: String(sale.cashier_name ?? ''), align: 'RIGHT', width: 0.6 },
  ]);
  printer.println(DASH);

  // ── ITEMS HEADER ───────────────────────────────────────────────────────────
  printer.bold(true);
  printer.tableCustom([
    { text: 'ITEM', align: 'LEFT', width: 0.42 },
    { text: 'QTY', align: 'RIGHT', width: 0.16 },
    { text: 'PRICE', align: 'RIGHT', width: 0.22 },
    { text: 'AMT', align: 'RIGHT', width: 0.20 },
  ]);
  printer.bold(false);
  printer.println(LINE);

  // ── ITEMS ──────────────────────────────────────────────────────────────────
  for (const item of items) {
    const itemName = String(item.product_name ?? '');
    const qty = fmt(item.quantity);
    const price = fmt(item.unit_price);
    const amt = fmt(item.subtotal);

    if (itemName.length > 18) {
      printer.alignLeft();
      printer.println(itemName);
      printer.tableCustom([
        { text: '', align: 'LEFT', width: 0.42 },
        { text: qty, align: 'RIGHT', width: 0.16 },
        { text: price, align: 'RIGHT', width: 0.22 },
        { text: amt, align: 'RIGHT', width: 0.20, bold: true },
      ]);
    } else {
      printer.tableCustom([
        { text: itemName, align: 'LEFT', width: 0.42 },
        { text: qty, align: 'RIGHT', width: 0.16 },
        { text: price, align: 'RIGHT', width: 0.22 },
        { text: amt, align: 'RIGHT', width: 0.20, bold: true },
      ]);
    }
  }

  printer.println(LINE);

  // ── COUNT ──────────────────────────────────────────────────────────────────
  printer.alignLeft();
  printer.println(`${items.length} item(s)  ${totalQty.toFixed(2)} units`);
  printer.newLine();

  // ── TOTAL ──────────────────────────────────────────────────────────────────
  printer.alignCenter();
  printer.bold(true);
  printer.setTextSize(1, 1);
  printer.println(`TOTAL: ${currency} ${fmt(total)}`);
  printer.setTextNormal();
  printer.bold(false);
  printer.println(DASH);

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  printer.alignCenter();
  if (settings.receipt_footer) printer.println(settings.receipt_footer);
  printer.println('Thank you for your business!');
  printer.println('*** Please come again ***');
  printer.newLine();
  printer.newLine();
  printer.cut();

  // Get the raw ESC/POS buffer without sending over network
  const rawBuffer = printer.getBuffer();

  // Prepend ESC @ (initialize / full reset) then ESC t 0 (PC437 USA code page).
  // This clears any Chinese code page the printer may have set as its default
  // before a single byte of our text arrives.
  const INIT = Buffer.from([
    0x1B, 0x40,       // ESC @  — initialize printer (resets code page, font, etc.)
    0x1B, 0x74, 0x00, // ESC t 0 — select PC437 USA character table
  ]);
  const buffer = Buffer.concat([INIT, rawBuffer]);

  await sendRawToPrinter(buffer, name);
}

/* ─── utils ────────────────────────────────────────────────────────────────── */

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

module.exports = { printReceipt, listPrinters, isPrinterReady };
