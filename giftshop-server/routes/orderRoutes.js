const router = require('express').Router();
const c = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');

router.use(protect);
router.post('/', validate({ body: v.order.create }), c.createOrder);
router.get('/my', validate({ query: v.pagination(50, 10) }), c.myOrders);
router.get('/:id', validate({ params: v.idParam }), c.getOrder);
router.get('/:id/invoice', validate({ params: v.idParam }), c.invoice);
router.put('/:id/cancel', validate({ params: v.idParam, body: v.order.cancel }), c.cancelMyOrder);

module.exports = router;
