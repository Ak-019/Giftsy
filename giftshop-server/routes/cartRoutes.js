const router = require('express').Router();
const c = require('../controllers/cartController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');

router.use(protect);
router.get('/', c.getCart);
router.post('/', validate({ body: v.cart.add }), c.addItem);
router.delete('/', c.clearCart);

router.put('/items/:itemId', validate({ params: v.cart.itemParam, body: v.cart.updateQty }), c.updateItem);
router.delete('/items/:itemId', validate({ params: v.cart.itemParam }), c.removeItem);
router.post('/items/:itemId/save-for-later', validate({ params: v.cart.itemParam }), c.saveForLater);

router.post('/saved/:itemId/move-to-cart', validate({ params: v.cart.itemParam }), c.moveToCart);
router.delete('/saved/:itemId', validate({ params: v.cart.itemParam }), c.removeSaved);

router.post('/coupon', validate({ body: v.cart.coupon }), c.applyCoupon);
router.delete('/coupon', c.removeCoupon);

module.exports = router;
