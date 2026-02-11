const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.send('Flomic Backend API is running...');
});

// Health Check Routes
// Keep a stable health endpoint that does not depend on MongoDB being available.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is healthy' });
});

app.get('/api/health', (req, res) => {
  const readyState = mongoose.connection?.readyState ?? 0;
  const dbConnected = readyState === 1;

  res.status(200).json({
    status: 'OK',
    serverTime: new Date().toISOString(),
    db: {
      connected: dbConnected,
      readyState,
    },
  });
});

// Start server (independent of DB connectivity so frontend can verify connection).
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});

// MongoDB Connection (optional for server start)
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.warn('MONGODB_URI is not set. Skipping MongoDB connection.');
} else {
  mongoose
    .connect(mongoURI)
    .then(() => {
      console.log('Connected to MongoDB successfully');
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err);
      // Keep server running even if DB is down; /api/health will reflect DB status.
    });
}
