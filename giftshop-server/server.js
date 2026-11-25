require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const app = require('./app');
const { startJobs } = require('./services/jobs');

// Refuse to start with missing or weak secrets in production
const prod = process.env.NODE_ENV === 'production';
const secrets = ['JWT_SECRET', ...(prod ? ['JWT_REFRESH_SECRET'] : [])];
for (const key of secrets) {
  const value = process.env[key];
  if (!value || (prod && (value.length < 32 || value.startsWith('change_this')))) {
    console.error(`${key} is missing or too weak. Set a random string of at least 32 characters in .env`);
    process.exit(1);
  }
}
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

const PORT = process.env.PORT || 5000;
let server;

connectDB()
  .then(() => {
    startJobs();
    server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  });

// Graceful shutdown: finish in-flight requests, then close the DB (Render/Docker send SIGTERM on deploy)
const shutdown = (signal) => {
  console.log(`${signal} received, shutting down...`);
  const done = () => mongoose.disconnect().finally(() => process.exit(0));
  if (server) server.close(done); else done();
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
