// Starts a throwaway MongoDB for each test file and wipes all collections between tests.
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('../app'); // registers every model

jest.setTimeout(120000);
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init())); // build indexes (text search, unique)
});

afterEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
