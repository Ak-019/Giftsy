const router = require('express').Router();
const c = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');

// The webhook (POST /api/payments/webhook) is mounted in app.js, because it needs the raw body.
router.get('/config', c.config);
router.post('/verify', protect, validate({ body: v.payment.verify }), c.verify);
router.post('/mock-pay', protect, validate({ body: v.payment.mockPay }), c.mockPay);

module.exports = router;
