const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename:    (_req, file, cb) => {
    // Derive extension from MIME type only — ignore client-supplied filename
    const MIME_EXT = {
      'image/jpeg': '.jpg',
      'image/png':  '.png',
      'image/gif':  '.gif',
      'image/webp': '.webp',
    };
    const ext = MIME_EXT[file.mimetype] || '.bin';
    cb(null, `shop-logo${ext}`);
  },
});

// SVG is intentionally excluded — it can contain embedded JavaScript (XSS)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

// Magic-byte signatures for allowed image types
const MAGIC = {
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png':  [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  'image/gif':  [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
  'image/webp': null, // checked separately below
};

/**
 * Read the first 12 bytes of a saved file and verify they match
 * the expected magic bytes for the declared MIME type.
 */
function validateMagicBytes(filePath, mimetype) {
  const buf = Buffer.alloc(12);
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 12, 0);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }

  if (mimetype === 'image/webp') {
    // RIFF....WEBP
    return buf.slice(0, 4).toString('ascii') === 'RIFF' &&
           buf.slice(8, 12).toString('ascii') === 'WEBP';
  }

  const sigs = MAGIC[mimetype];
  if (!sigs) return false;
  return sigs.some((sig) => buf.slice(0, sig.length).equals(sig));
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(Object.assign(
        new Error('Only JPG, PNG, GIF, or WEBP images are allowed.'),
        { status: 400 }
      ));
    }
    cb(null, true);
  },
});

module.exports = { upload, validateMagicBytes };
