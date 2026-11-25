const mongoose = require('mongoose');

module.exports = async function connectDB(uri = process.env.MONGO_URI) {
  if (!uri) throw new Error('MONGO_URI is not set. Copy .env.example to .env and fill it in.');
  mongoose.set('strictQuery', true); // ignore unknown fields in query filters
  await mongoose.connect(uri, {
    maxPoolSize: Number(process.env.MONGO_POOL_SIZE || 20), // connections shared by all requests
    serverSelectionTimeoutMS: 10000,
  });
  console.log('MongoDB connected');
};
