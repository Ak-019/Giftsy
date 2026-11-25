const router = require('express').Router();
const c = require('../controllers/uploadController');
const { protect, adminOnly } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.post('/', protect, adminOnly, upload.array('images', 5), c.uploadImages);

module.exports = router;
