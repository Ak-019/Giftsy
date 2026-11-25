const router = require('express').Router();
const c = require('../controllers/productController');
const r = require('../controllers/reviewController');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');

// Fixed paths first, so "meta" or "slug" are never read as an :id
router.get('/', validate({ query: v.product.listQuery }), c.getProducts);
router.get('/meta', c.getMeta);
router.get('/suggest', validate({ query: v.product.suggestQuery }), c.suggest);
router.get('/gift-finder', validate({ query: v.product.giftFinderQuery }), c.giftFinder);
router.get('/slug/:slug', optionalAuth, validate({ params: v.product.slugParam }), c.getProductBySlug);
router.get('/:id', optionalAuth, validate({ params: v.idParam }), c.getProduct);

router.get('/:id/reviews', validate({ params: v.idParam, query: v.review.listQuery }), r.listForProduct);
router.post('/:id/reviews', protect, validate({ params: v.idParam, body: v.review.create }), r.addReview);

router.post('/', protect, adminOnly, validate({ body: v.product.create }), c.createProduct);
router.put('/:id', protect, adminOnly, validate({ params: v.idParam, body: v.product.update }), c.updateProduct);
router.delete('/:id', protect, adminOnly, validate({ params: v.idParam }), c.deleteProduct);

module.exports = router;
