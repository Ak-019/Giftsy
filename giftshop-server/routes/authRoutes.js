const router = require('express').Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const v = require('../validators');
const requireAjaxHeader = require('../middleware/csrf');

router.post('/register', authLimiter, validate({ body: v.auth.register }), c.register);
router.post('/login', authLimiter, validate({ body: v.auth.login }), c.login);
router.post('/refresh', requireAjaxHeader, c.refresh);
router.post('/logout', requireAjaxHeader, c.logout);
router.post('/logout-all', protect, c.logoutAll);
router.get('/me', protect, c.me);

module.exports = router;
