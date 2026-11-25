const router = require('express').Router();
const a = require('../controllers/adminController');
const p = require('../controllers/productController');
const coupons = require('../controllers/couponController');
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');

router.use(protect, adminOnly);

router.get('/stats', validate({ query: v.admin.statsQuery }), a.stats);

router.get('/orders', validate({ query: v.order.adminListQuery }), a.listOrders);
router.put('/orders/:id/status', validate({ params: v.idParam, body: v.order.updateStatus }), a.updateOrderStatus);

router.patch('/products/stock', validate({ body: v.product.bulkStock }), p.bulkUpdateStock);

router.get('/users', validate({ query: v.admin.usersQuery }), a.listUsers);
router.put('/users/:id/block', validate({ params: v.idParam, body: v.admin.block }), a.setBlocked);

router.get('/reviews', validate({ query: v.admin.reviewsQuery }), a.listReviews);

router.get('/coupons', coupons.adminList);
router.post('/coupons', validate({ body: v.coupon.create }), coupons.create);
router.put('/coupons/:id', validate({ params: v.idParam, body: v.coupon.update }), coupons.update);
router.delete('/coupons/:id', validate({ params: v.idParam }), coupons.remove);

module.exports = router;
