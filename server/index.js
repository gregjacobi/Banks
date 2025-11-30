const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected successfully');

    // Initialize GridFS buckets for file storage
    const { initializeGridFS } = require('./config/gridfs');
    initializeGridFS();

    // Optional: Clear UBPR cache on startup
    // Set CLEAR_UBPR_CACHE_ON_STARTUP=true in .env to enable
    if (process.env.CLEAR_UBPR_CACHE_ON_STARTUP === 'true') {
      try {
        const UBPRData = require('./models/UBPRData');
        const result = await UBPRData.deleteMany({});
        console.log(`✓ Cleared ${result.deletedCount} UBPR cache entries on startup`);
      } catch (error) {
        console.error('Error clearing UBPR cache on startup:', error.message);
      }
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
const banksRouter = require('./routes/banks');
const researchRouter = require('./routes/research');
const ubprRouter = require('./routes/ubpr');
const ffiecRouter = require('./routes/ffiec');
const groundingRouter = require('./routes/grounding');
const feedbackRouter = require('./routes/feedback');
const constitutionRouter = require('./routes/constitution');
const tamRouter = require('./routes/tam');
const teamRouter = require('./routes/team');
const strategicPrioritiesRouter = require('./routes/strategicPriorities');
app.use('/api/banks', banksRouter);
app.use('/api/research', researchRouter);
app.use('/api/ubpr', ubprRouter);
app.use('/api/ffiec', ffiecRouter);
app.use('/api/grounding', groundingRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/constitution', constitutionRouter);
app.use('/api/tam', tamRouter);
app.use('/api/team', teamRouter);
app.use('/api/strategic-priorities', strategicPrioritiesRouter);

app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Hello World! Bank Explorer API is running.',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'build')));

  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
