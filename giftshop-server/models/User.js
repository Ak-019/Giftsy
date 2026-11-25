const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { OCCASIONS } = require('../config/constants');

const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home', trim: true }, // Home, Office, Mom's place...
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  line1: { type: String, required: true, trim: true },
  line2: { type: String, default: '', trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  pincode: { type: String, required: true, trim: true },
  isDefault: { type: Boolean, default: false },
});

// Birthdays, anniversaries etc. the user wants to be reminded about
const occasionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: OCCASIONS, default: 'Birthday' },
  personName: { type: String, default: '', trim: true },
  date: { type: Date, required: true },
  recurring: { type: Boolean, default: true }, // repeats every year
  note: { type: String, default: '', trim: true },
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
  phone: { type: String, default: '', trim: true },
  password: { type: String, required: true, minlength: [6, 'Password must be at least 6 characters'], select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isBlocked: { type: Boolean, default: false },
  tokenVersion: { type: Number, default: 0 }, // bump to log the user out of all devices
  addresses: [addressSchema],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  occasions: [occasionSchema],
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      delete ret.password;
      delete ret.tokenVersion;
      delete ret.__v;
      return ret;
    },
  },
});

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function matchPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
