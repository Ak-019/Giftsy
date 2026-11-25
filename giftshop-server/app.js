// The Express app, without starting a server or connecting to MongoDB, so tests can import it.
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const { notFound, errorHandler } = require('./middleware/error');
const { apiLimiter } = require('./middleware/rateLimit');
const paymentController = require('./controllers/paymentController');

const app = express();
app.set('trust proxy', 1); // Render/Vercel sit behind a proxy: needed for correct client IPs in rate limiting

// cross-origin resource policy relaxed so the frontend (another origin) can show uploaded images
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(cors({
  origin: origins,
  credentials: true, // allow the refresh-token cookie
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 600,
}));
app.use(compression()); // gzip JSON responses

// Razorpay webhook needs the raw body to check its signature, so it goes BEFORE express.json()
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), paymentController.webhook);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(mongoSanitize()); // strips keys like "$gt" from body/query/params (NoSQL injection)
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d', dotfiles: 'deny', index: false }));
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/account', require('./routes/accountRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/coupons', require('./routes/couponRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/uploads', require('./routes/uploadRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
