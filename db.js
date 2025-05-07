const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config(); // Load environment variables from .env

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('❌ MONGO_URI is undefined. Please check your .env file.');
    return;
  }

  try {
    await mongoose.connect(uri); // No need for useNewUrlParser and useUnifiedTopology

    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ Error connecting to MongoDB Atlas:', err.message);
  }
};

module.exports = connectDB;
