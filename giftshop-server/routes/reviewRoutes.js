const router = require('express').Router();
const r = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');

router.use(protect);
router.put('/:id', validate({ params: v.idParam, body: v.review.update }), r.updateReview);
router.delete('/:id', validate({ params: v.idParam }), r.deleteReview);

module.exports = router;
