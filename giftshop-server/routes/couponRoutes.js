const router = require('express').Router();
const c = require('../controllers/couponController');

router.get('/', c.listActive);

module.exports = router;
