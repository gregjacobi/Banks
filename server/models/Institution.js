const mongoose = require('mongoose');

const institutionSchema = new mongoose.Schema({
  idrssd: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    index: 'text' // Enable text search
  },
  fdicCert: String,
  occCharter: String,
  abaRouting: String,
  address: String,
  city: String,
  state: String,
  zipCode: String,
  filingType: String,
  lastUpdated: Date,
  // AI Research fields
  website: String,
  investorRelationsUrl: String,
  lastResearchUpdate: Date
}, {
  timestamps: true
});

// Index for sorting by name
institutionSchema.index({ name: 1 });

module.exports = mongoose.model('Institution', institutionSchema);
