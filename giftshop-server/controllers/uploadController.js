const fs = require('fs/promises');
const AppError = require('../utils/AppError');

// The browser-reported MIME type can be faked, so check the file's first bytes too.
const SIGNATURES = [
  (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, // JPEG
  (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), // PNG
  (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP', // WEBP
];

async function isRealImage(filePath) {
  const fh = await fs.open(filePath, 'r');
  try {
    const { buffer } = await fh.read(Buffer.alloc(12), 0, 12, 0);
    return SIGNATURES.some((check) => check(buffer));
  } finally {
    await fh.close();
  }
}

// POST /api/uploads  (multipart/form-data, field "images", up to 5 files)
// Returns paths to put in a product's "images" array.
exports.uploadImages = async (req, res, next) => {
  try {
    if (!req.files?.length) throw new AppError('No images uploaded. Use the form field "images".');
    const checks = await Promise.all(req.files.map((f) => isRealImage(f.path)));
    if (checks.includes(false)) {
      await Promise.all(req.files.map((f) => fs.unlink(f.path).catch(() => {})));
      throw new AppError('One of the files is not a valid JPG, PNG or WEBP image');
    }
    const base = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
    const images = req.files.map((f) => ({ path: `/uploads/${f.filename}`, url: `${base}/uploads/${f.filename}`, size: f.size }));
    res.status(201).json({ success: true, images });
  } catch (err) {
    next(err);
  }
};
