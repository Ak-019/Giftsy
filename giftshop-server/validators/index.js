// Zod schemas for every route. Unknown fields are stripped, types are coerced and checked.
const { z } = require('zod');
const {
  OCCASIONS, RECIPIENTS, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, MAX_QTY_PER_ITEM,
} = require('../config/constants');

// ---------- building blocks ----------
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid id');
const text = (min, max) => z.string().trim().min(min).max(max);
const email = z.string().trim().toLowerCase().email('must be a valid email');
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'must be a valid 10-digit mobile number');
const pincode = z.string().trim().regex(/^\d{6}$/, 'must be a 6-digit pincode');
const csvList = z.string().trim().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)).optional(); // ?category=Mugs,Toys
const boolString = z.enum(['true', 'false']).transform((v) => v === 'true').optional();
const page = z.coerce.number().int().min(1).default(1);
const limit = (max, def) => z.coerce.number().int().min(1).max(max).default(def);
const couponCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, 'must be 3-20 letters or digits');

const idParam = z.object({ id: objectId });
const pagination = (max = 50, def = 12) => z.object({ page, limit: limit(max, def) });

const address = z.object({
  label: z.string().trim().max(30).optional(),
  fullName: text(2, 80),
  phone,
  line1: text(3, 200),
  line2: z.string().trim().max(200).optional(),
  city: text(2, 60),
  state: text(2, 60),
  pincode,
  isDefault: z.boolean().optional(),
});
const shippingAddress = address.omit({ label: true, isDefault: true });

// ---------- auth & account ----------
const auth = {
  register: z.object({ name: text(2, 60), email, password: z.string().min(6, 'must be at least 6 characters').max(72) }),
  login: z.object({ email, password: z.string().min(1, 'is required').max(72) }),
};

// Base shapes have NO defaults: Zod 4 applies defaults even inside .partial(), which would make
// an "update" silently reset fields. Defaults are added only on the create schemas.
const occasion = z.object({
  title: text(2, 80),
  type: z.enum(OCCASIONS),
  personName: z.string().trim().max(60).optional(),
  date: z.coerce.date(),
  recurring: z.boolean(),
  note: z.string().trim().max(200).optional(),
});

const account = {
  updateProfile: z.object({ name: text(2, 60).optional(), phone: phone.optional() })
    .refine((o) => Object.keys(o).length > 0, 'Nothing to update'),
  changePassword: z.object({
    currentPassword: z.string().min(1, 'is required'),
    newPassword: z.string().min(6, 'must be at least 6 characters').max(72),
  }).refine((o) => o.currentPassword !== o.newPassword, { message: 'must be different from the current password', path: ['newPassword'] }),
  addressCreate: address.extend({ line2: z.string().trim().max(200).optional().default('') }),
  addressUpdate: address.partial().refine((o) => Object.keys(o).length > 0, 'Nothing to update'),
  occasionCreate: occasion.extend({ type: z.enum(OCCASIONS).default('Birthday'), recurring: z.boolean().default(true) }),
  occasionUpdate: occasion.partial().refine((o) => Object.keys(o).length > 0, 'Nothing to update'),
  upcomingQuery: z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }),
  productIdParam: z.object({ productId: objectId }),
};

// ---------- products & reviews ----------
const variant = z.object({ name: text(1, 40), priceDelta: z.number().min(-100000).max(100000).default(0) });
const imageUrl = z.string().trim().url().or(z.string().trim().regex(/^\/uploads\/[\w.-]+$/));

const productFields = z.object({
  name: text(2, 120),
  description: text(10, 2000),
  price: z.number().positive(),
  discountPrice: z.number().positive().nullable().optional(),
  category: text(2, 50),
  occasions: z.array(z.enum(OCCASIONS)).max(10),
  recipients: z.array(z.enum(RECIPIENTS)).max(10),
  images: z.array(imageUrl).max(8),
  stock: z.number().int().min(0).max(100000),
  variants: z.array(variant).max(20)
    .refine((vs) => new Set(vs.map((v) => v.name.toLowerCase())).size === vs.length, 'variant names must be unique'),
  isFeatured: z.boolean(),
});
const productCreateFields = productFields.extend({
  occasions: productFields.shape.occasions.default([]),
  recipients: productFields.shape.recipients.default([]),
  images: productFields.shape.images.default([]),
  variants: productFields.shape.variants.default([]),
  isFeatured: z.boolean().default(false),
});

const product = {
  create: productCreateFields.refine((p) => p.discountPrice == null || p.discountPrice < p.price, {
    message: 'must be lower than price', path: ['discountPrice'],
  }),
  update: productFields.partial().refine((o) => Object.keys(o).length > 0, 'Nothing to update'),
  listQuery: z.object({
    search: z.string().trim().max(100).optional(),
    category: csvList,
    occasion: csvList,
    recipient: csvList,
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    inStock: boolString,
    featured: boolString,
    sort: z.enum(['relevance', 'newest', 'priceAsc', 'priceDesc', 'rating', 'popular', 'stock']).optional(),
    page,
    limit: limit(50, 12),
  }),
  suggestQuery: z.object({ q: text(1, 50) }),
  giftFinderQuery: z.object({
    recipient: z.enum(RECIPIENTS).optional(),
    occasion: z.enum(OCCASIONS).optional(),
    budgetMin: z.coerce.number().min(0).default(0),
    budgetMax: z.coerce.number().positive().optional(),
    interests: csvList, // categories, e.g. "Food,Home Decor"
    limit: limit(20, 8),
  }),
  slugParam: z.object({ slug: text(1, 100) }),
  bulkStock: z.object({
    items: z.array(z.object({ id: objectId, stock: z.number().int().min(0) })).min(1).max(200),
  }),
};

const review = {
  create: z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional().default('') }),
  update: z.object({ rating: z.number().int().min(1).max(5).optional(), comment: z.string().trim().max(500).optional() })
    .refine((o) => Object.keys(o).length > 0, 'Nothing to update'),
  listQuery: z.object({ sort: z.enum(['newest', 'highest', 'lowest']).default('newest'), page, limit: limit(50, 10) }),
};

// ---------- cart & coupons ----------
const cart = {
  add: z.object({
    productId: objectId,
    qty: z.coerce.number().int().min(1).max(MAX_QTY_PER_ITEM).default(1),
    variant: z.string().trim().max(40).optional().default(''),
  }),
  updateQty: z.object({ qty: z.coerce.number().int().min(1).max(MAX_QTY_PER_ITEM) }),
  itemParam: z.object({ itemId: objectId }),
  coupon: z.object({ code: couponCode }),
};

const couponFields = z.object({
  code: couponCode,
  description: z.string().trim().max(200),
  type: z.enum(['percent', 'flat']),
  value: z.number().positive(),
  minOrder: z.number().min(0),
  maxDiscount: z.number().positive().nullable().optional(),
  expiresAt: z.coerce.date(),
  usageLimit: z.number().int().positive().nullable().optional(),
  onePerUser: z.boolean(),
  isActive: z.boolean(),
});
const couponCreateFields = couponFields.extend({
  description: z.string().trim().max(200).default(''),
  minOrder: z.number().min(0).default(0),
  onePerUser: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

const coupon = {
  create: couponCreateFields
    .refine((c) => c.type !== 'percent' || c.value <= 100, { message: 'percent value must be 100 or less', path: ['value'] })
    .refine((c) => c.expiresAt > new Date(), { message: 'must be in the future', path: ['expiresAt'] }),
  update: couponFields.partial()
    .refine((c) => !(c.type === 'percent' && c.value > 100), { message: 'percent value must be 100 or less', path: ['value'] })
    .refine((o) => Object.keys(o).length > 0, 'Nothing to update'),
};

// ---------- orders & payments ----------
const order = {
  create: z.object({
    addressId: objectId.optional(), // use a saved address...
    shippingAddress: shippingAddress.optional(), // ...or send one ("ship to someone else")
    shipToSomeoneElse: z.boolean().default(false),
    giftMessage: z.string().trim().max(250).default(''),
    giftWrap: z.boolean().default(false),
    deliveryDate: z.coerce.date().optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).default('COD'),
  }).refine((o) => o.addressId || o.shippingAddress, { message: 'Provide addressId or shippingAddress', path: ['shippingAddress'] }),
  cancel: z.object({ reason: z.string().trim().max(200).optional() }),
  updateStatus: z.object({ status: z.enum(ORDER_STATUSES), note: z.string().trim().max(200).optional() }),
  adminListQuery: z.object({
    status: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    search: z.string().trim().max(100).optional(), // order number, customer name or email
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page,
    limit: limit(100, 20),
  }),
};

const payment = {
  verify: z.object({
    orderId: objectId,
    razorpay_order_id: text(1, 100),
    razorpay_payment_id: text(1, 100),
    razorpay_signature: text(1, 200),
  }),
  mockPay: z.object({ orderId: objectId }),
};

// ---------- admin ----------
const admin = {
  statsQuery: z.object({ days: z.coerce.number().int().min(7).max(365).default(30) }),
  usersQuery: z.object({
    search: z.string().trim().max(100).optional(),
    role: z.enum(['user', 'admin']).optional(),
    blocked: boolString,
    page,
    limit: limit(100, 20),
  }),
  block: z.object({ isBlocked: z.boolean() }),
  reviewsQuery: z.object({
    product: objectId.optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    page,
    limit: limit(100, 20),
  }),
};

module.exports = { objectId, idParam, pagination, auth, account, product, review, cart, coupon, order, payment, admin };
