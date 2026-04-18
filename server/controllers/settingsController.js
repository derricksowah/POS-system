const path = require('path');
const fs   = require('fs');
const settingsService = require('../services/settingsService');
const { logActivity } = require('../middleware/activityLogger');
const { validateMagicBytes } = require('../middleware/upload');

const uploadsDir = path.resolve(__dirname, '..', 'uploads');

/**
 * Safely resolve a logo URL stored in the DB to an absolute path.
 * Returns null if the path would escape the uploads directory.
 */
function safeLogoPath(logoUrl) {
  if (!logoUrl) return null;
  // Strip leading slash/backslash and any query string
  const relative = logoUrl.replace(/^[/\\]+/, '').split('?')[0];
  const resolved = path.resolve(uploadsDir, path.basename(relative));
  // Ensure the resolved path is inside uploadsDir (prevent path traversal)
  if (!resolved.startsWith(uploadsDir + path.sep) && resolved !== uploadsDir) return null;
  return resolved;
}

async function getSettings(req, res, next) {
  try {
    const settings = await settingsService.getSettings();
    res.json(settings || {});
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    // logo_url is managed by the upload endpoint — preserve whatever is stored
    const current = await settingsService.getSettings();
    const data = { ...req.body, logo_url: current?.logo_url || '' };
    const settings = await settingsService.updateSettings(data);
    await logActivity({ userId: req.user.id, action: 'UPDATE_SETTINGS', ipAddress: req.ip });
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

async function uploadLogo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Validate magic bytes — reject files whose content doesn't match their MIME type
    if (!validateMagicBytes(req.file.path, req.file.mimetype)) {
      fs.unlinkSync(req.file.path); // delete the suspicious file immediately
      return res.status(400).json({ error: 'File content does not match the declared image type.' });
    }

    // Delete any old logo file with a different extension
    const newFilename = req.file.filename;
    const exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    for (const ext of exts) {
      const candidate = path.join(uploadsDir, `shop-logo${ext}`);
      if (candidate !== req.file.path && fs.existsSync(candidate)) {
        fs.unlinkSync(candidate);
      }
    }

    // Store the public URL in settings
    const logoUrl = `/uploads/${newFilename}`;
    const current = await settingsService.getSettings();
    const settings = await settingsService.updateSettings({
      shop_name:      current?.shop_name      || 'My Shop',
      shop_address:   current?.shop_address   || '',
      phone_number:   current?.phone_number   || '',
      currency:       current?.currency       || 'GHS',
      receipt_header: current?.receipt_header || '',
      receipt_footer: current?.receipt_footer || '',
      logo_url: logoUrl,
    });

    await logActivity({ userId: req.user.id, action: 'UPLOAD_LOGO', ipAddress: req.ip });
    res.json({ logo_url: logoUrl, settings });
  } catch (err) {
    next(err);
  }
}

async function deleteLogo(req, res, next) {
  try {
    const current = await settingsService.getSettings();
    if (current?.logo_url) {
      const filePath = safeLogoPath(current.logo_url);
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    const settings = await settingsService.updateSettings({ ...current, logo_url: '' });
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSettings, updateSettings, uploadLogo, deleteLogo };
