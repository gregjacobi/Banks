const mongoose = require('mongoose');

/**
 * BankMetadata Schema
 * Stores additional metadata about a bank gathered by AI
 * (logo, organizational structure, ticker symbol, etc.)
 */
const bankMetadataSchema = new mongoose.Schema({
  // Bank identifier
  idrssd: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  bankName: {
    type: String,
    required: true
  },

  // Website information
  websiteUrl: {
    type: String
  },

  // Logo
  logo: {
    url: {
      type: String // URL to the full logo image
    },
    localPath: {
      type: String // Path to downloaded full logo file
    },
    symbolUrl: {
      type: String // URL to the symbol/square logo image
    },
    symbolLocalPath: {
      type: String // Path to downloaded symbol logo file
    },
    source: {
      type: String // Where the logo was found (e.g., "Wikipedia", "Official Website", "Brandfetch")
    },
    lastUpdated: {
      type: Date
    }
  },

  // Ticker symbol and stock information
  ticker: {
    symbol: {
      type: String // Stock ticker symbol (e.g., "JPM", "BAC")
    },
    exchange: {
      type: String // Stock exchange (e.g., "NYSE", "NASDAQ")
    },
    isPubliclyTraded: {
      type: Boolean,
      default: false
    },
    source: {
      type: String // Where ticker was found
    },
    lastUpdated: {
      type: Date
    }
  },

  // Organizational structure
  orgChart: {
    // Board of Directors
    boardMembers: [{
      name: {
        type: String,
        required: true
      },
      title: {
        type: String // e.g., "Chairman", "Director", "Independent Director"
      },
      role: {
        type: String // Additional role details
      },
      since: {
        type: String // Year or date they joined
      }
    }],

    // Executive Leadership
    executives: [{
      name: {
        type: String,
        required: true
      },
      title: {
        type: String, // e.g., "CEO", "CFO", "COO"
        required: true
      },
      department: {
        type: String // e.g., "Finance", "Operations", "Technology"
      },
      bio: {
        type: String // Brief biography
      },
      since: {
        type: String // Year or date they joined
      }
    }],

    // Source and metadata
    source: {
      type: String // Where org chart data was found
    },
    lastUpdated: {
      type: Date
    },
    notes: {
      type: String // Any notes about the org chart data
    }
  },

  // Strategic Insights (extracted from RAG)
  strategicInsights: {
    // Top strategic priorities
    priorities: [{
      title: {
        type: String,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      // Citations - research paper style references
      citations: [{
        documentTitle: {
          type: String, // Title of source document (e.g., "Q3 2024 Investor Presentation")
          required: true
        },
        documentUrl: {
          type: String // URL to access the document if available
        },
        citedText: {
          type: String, // Exact text quoted from the document
          required: true
        },
        locationType: {
          type: String,
          enum: ['page', 'char', 'block'], // Type of location reference
          default: 'page'
        },
        pageNumber: {
          type: Number // For PDF citations (1-indexed)
        },
        startChar: {
          type: Number // For text citations (0-indexed)
        },
        endChar: {
          type: Number // For text citations (0-indexed)
        }
      }],
      // Brief explanation of how this priority was determined
      methodology: {
        type: String // E.g., "Extracted from Q3 2024 earnings call where CEO mentioned this as a 'top priority' 3 times"
      }
    }],

    // Metrics management/investors are focused on
    focusMetrics: [{
      metric: {
        type: String,
        required: true
      },
      commentary: {
        type: String // Analyst or management commentary
      },
      // Citations
      citations: [{
        documentTitle: {
          type: String,
          required: true
        },
        documentUrl: {
          type: String
        },
        citedText: {
          type: String,
          required: true
        },
        locationType: {
          type: String,
          enum: ['page', 'char', 'block'],
          default: 'page'
        },
        pageNumber: {
          type: Number
        },
        startChar: {
          type: Number
        },
        endChar: {
          type: Number
        }
      }],
      methodology: {
        type: String
      }
    }],

    // Technology partnerships and initiatives
    techPartnerships: [{
      partner: {
        type: String,
        required: true
      },
      description: {
        type: String
      },
      announcedDate: {
        type: String // When this was announced/discussed
      },
      // Citations
      citations: [{
        documentTitle: {
          type: String,
          required: true
        },
        documentUrl: {
          type: String
        },
        citedText: {
          type: String,
          required: true
        },
        locationType: {
          type: String,
          enum: ['page', 'char', 'block'],
          default: 'page'
        },
        pageNumber: {
          type: Number
        },
        startChar: {
          type: Number
        },
        endChar: {
          type: Number
        }
      }],
      methodology: {
        type: String
      }
    }],

    // Metadata
    status: {
      type: String,
      enum: ['not_extracted', 'extracting', 'completed', 'failed'],
      default: 'not_extracted'
    },
    lastExtracted: {
      type: Date
    },
    extractionError: {
      type: String
    },
    source: {
      type: String // E.g., "RAG analysis of investor presentations and earnings transcripts"
    },
    // Overall methodology explanation for the entire extraction process
    extractionMethodology: {
      type: String // E.g., "Analyzed 5 documents using Claude's Citations API with RAG. Extracted priorities mentioned by CEO/CFO in earnings calls and presentations."
    }
  },

  // Gathering status
  gatheringStatus: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'failed'],
    default: 'not_started'
  },

  lastGathered: {
    type: Date
  },

  gatheringError: {
    type: String // Error message if gathering failed
  },

  // Research Workflow Phase Tracking
  researchPhases: {
    // Phase 1: Gather sources from web
    phase1: {
      status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'failed'],
        default: 'not_started'
      },
      completedAt: Date,
      sessionId: String,
      sourcesFound: Number,
      error: String
    },

    // Phase 2: Select and upload PDFs to RAG
    phase2: {
      status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'failed'],
        default: 'not_started'
      },
      completedAt: Date,
      pdfsUploaded: Number,
      pdfsProcessed: Number,
      error: String
    },

    // Phase 3: Extract insights from RAG
    phase3: {
      status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'failed'],
        default: 'not_started'
      },
      completedAt: Date,
      insightsExtracted: Boolean,
      error: String
    },

    // Phase 4: Generate AI research report
    phase4: {
      status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'failed'],
        default: 'not_started'
      },
      completedAt: Date,
      reportId: String,
      error: String
    }
  }

}, {
  timestamps: true
});

// Instance methods

/**
 * Update logo information
 */
bankMetadataSchema.methods.updateLogo = async function(logoData) {
  // Reload document to avoid version conflicts
  const fresh = await this.constructor.findOne({ idrssd: this.idrssd });
  if (!fresh) {
    throw new Error(`BankMetadata not found for idrssd: ${this.idrssd}`);
  }
  fresh.logo = {
    ...logoData,
    lastUpdated: new Date()
  };
  return fresh.save();
};

/**
 * Update ticker information
 */
bankMetadataSchema.methods.updateTicker = async function(tickerData) {
  // Reload document to avoid version conflicts
  const fresh = await this.constructor.findOne({ idrssd: this.idrssd });
  if (!fresh) {
    throw new Error(`BankMetadata not found for idrssd: ${this.idrssd}`);
  }
  fresh.ticker = {
    ...tickerData,
    lastUpdated: new Date()
  };
  return fresh.save();
};

/**
 * Update org chart information
 */
bankMetadataSchema.methods.updateOrgChart = async function(orgChartData) {
  // Reload document to avoid version conflicts
  const fresh = await this.constructor.findOne({ idrssd: this.idrssd });
  if (!fresh) {
    throw new Error(`BankMetadata not found for idrssd: ${this.idrssd}`);
  }
  fresh.orgChart = {
    ...orgChartData,
    lastUpdated: new Date()
  };
  return fresh.save();
};

/**
 * Mark gathering as in progress
 */
bankMetadataSchema.methods.startGathering = async function() {
  this.gatheringStatus = 'in_progress';
  return this.save();
};

/**
 * Mark gathering as completed
 */
bankMetadataSchema.methods.completeGathering = async function() {
  this.gatheringStatus = 'completed';
  this.lastGathered = new Date();
  this.gatheringError = null;
  return this.save();
};

/**
 * Mark gathering as failed
 */
bankMetadataSchema.methods.failGathering = async function(errorMessage) {
  this.gatheringStatus = 'failed';
  this.gatheringError = errorMessage;
  return this.save();
};

/**
 * Update strategic insights
 */
bankMetadataSchema.methods.updateStrategicInsights = async function(insightsData) {
  // Reload document to avoid version conflicts
  const fresh = await this.constructor.findOne({ idrssd: this.idrssd });
  if (!fresh) {
    throw new Error(`BankMetadata not found for idrssd: ${this.idrssd}`);
  }
  fresh.strategicInsights = {
    ...fresh.strategicInsights,
    ...insightsData,
    status: 'completed',
    lastExtracted: new Date(),
    extractionError: null
  };
  return fresh.save();
};

/**
 * Mark insight extraction as in progress
 */
bankMetadataSchema.methods.startInsightExtraction = async function() {
  if (!this.strategicInsights) {
    this.strategicInsights = {};
  }
  this.strategicInsights.status = 'extracting';
  return this.save();
};

/**
 * Mark insight extraction as failed
 */
bankMetadataSchema.methods.failInsightExtraction = async function(errorMessage) {
  if (!this.strategicInsights) {
    this.strategicInsights = {};
  }
  this.strategicInsights.status = 'failed';
  this.strategicInsights.extractionError = errorMessage;
  return this.save();
};

/**
 * Update research phase status
 */
bankMetadataSchema.methods.updateResearchPhase = async function(phase, status, data = {}) {
  if (!this.researchPhases) {
    this.researchPhases = {};
  }
  if (!this.researchPhases[phase]) {
    this.researchPhases[phase] = {};
  }

  this.researchPhases[phase].status = status;

  if (status === 'completed') {
    this.researchPhases[phase].completedAt = new Date();
  }

  // Merge additional data
  Object.assign(this.researchPhases[phase], data);

  this.markModified('researchPhases');
  return this.save();
};

/**
 * Get research phase status
 */
bankMetadataSchema.methods.getResearchStatus = function() {
  if (!this.researchPhases) {
    return {
      phase1: 'not_started',
      phase2: 'not_started',
      phase3: 'not_started',
      phase4: 'not_started'
    };
  }

  return {
    phase1: this.researchPhases.phase1?.status || 'not_started',
    phase2: this.researchPhases.phase2?.status || 'not_started',
    phase3: this.researchPhases.phase3?.status || 'not_started',
    phase4: this.researchPhases.phase4?.status || 'not_started',
    details: this.researchPhases
  };
};

// Static methods

/**
 * Get or create metadata for a bank
 */
bankMetadataSchema.statics.getOrCreate = async function(idrssd, bankName) {
  let metadata = await this.findOne({ idrssd });
  if (!metadata) {
    metadata = new this({
      idrssd,
      bankName,
      gatheringStatus: 'not_started',
      researchPhases: {
        phase1: { status: 'not_started' },
        phase2: { status: 'not_started' },
        phase3: { status: 'not_started' },
        phase4: { status: 'not_started' }
      }
    });
    await metadata.save();
  }
  return metadata;
};

module.exports = mongoose.model('BankMetadata', bankMetadataSchema);
