const router = require('express').Router();
const c = require('../controllers/accountController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');

router.use(protect);

router.put('/profile', validate({ body: v.account.updateProfile }), c.updateProfile);
router.put('/password', validate({ body: v.account.changePassword }), c.changePassword);

router.get('/addresses', c.listAddresses);
router.post('/addresses', validate({ body: v.account.addressCreate }), c.addAddress);
router.put('/addresses/:id', validate({ params: v.idParam, body: v.account.addressUpdate }), c.updateAddress);
router.delete('/addresses/:id', validate({ params: v.idParam }), c.deleteAddress);

router.get('/wishlist', c.getWishlist);
router.post('/wishlist/:productId', validate({ params: v.account.productIdParam }), c.toggleWishlist);
router.delete('/wishlist/:productId', validate({ params: v.account.productIdParam }), c.removeFromWishlist);

router.get('/occasions', c.listOccasions);
router.get('/occasions/upcoming', validate({ query: v.account.upcomingQuery }), c.upcoming);
router.post('/occasions', validate({ body: v.account.occasionCreate }), c.addOccasion);
router.put('/occasions/:id', validate({ params: v.idParam, body: v.account.occasionUpdate }), c.updateOccasion);
router.delete('/occasions/:id', validate({ params: v.idParam }), c.deleteOccasion);

module.exports = router;
