# RAG Expert Grounding System - Setup Guide

## ✅ What's Been Built

You now have a complete RAG (Retrieval Augmented Generation) system that allows you to upload research papers about bank analysis, and the AI agent will use that knowledge when generating reports.

### Features Implemented:
- ✅ PDF upload and processing
- ✅ Automatic chunking (512 tokens, 20% overlap)
- ✅ Voyage AI embeddings (1024 dimensions)
- ✅ **In-memory similarity search** (works with local MongoDB, no Atlas required)
- ✅ Automatic tag suggestions (editable)
- ✅ Agent integration with source citations
- ✅ Retrieval based on bank type and context

### Architecture Note:
This implementation uses **in-memory cosine similarity** for vector search, which works perfectly with local MongoDB for up to ~10,000 chunks (~100 PDFs). No MongoDB Atlas or special setup required!

---

## 🚀 Quick Start (2 Steps)

### Step 1: Upload a Research PDF

**Via API (curl):**
```bash
curl -X POST http://localhost:5001/api/grounding/upload \
  -F "pdf=@path/to/your/research-paper.pdf" \
  -F "title=Bank Analysis Best Practices" \
  -F 'topics=["liquidity","capital","efficiency"]' \
  -F 'bankTypes=["all"]'
```

**Or use the API endpoint in your app:**
- `POST /api/grounding/upload`
- Form data with PDF file + metadata

The system will:
1. Auto-suggest topics and bank types (you can edit)
2. Extract text from PDF
3. Split into 512-token chunks
4. Generate embeddings via Voyage AI
5. Store in MongoDB with vectors

### Step 2: Run Agent Research

When you run agent research on a bank, it will:
1. Automatically retrieve relevant chunks based on:
   - Bank type (community, regional, large, mega)
   - Analysis context
2. Include retrieved content in the prompt as grounding
3. Agent cites sources as `[Source 1]`, `[Source 2]`, etc.

**That's it!** The agent now has expert knowledge.

---

## 📁 Files Created

### Models
- `server/models/GroundingDocument.js` - PDF documents
- `server/models/GroundingChunk.js` - Text chunks with embeddings

### Services
- `server/services/voyageClient.js` - Voyage AI API wrapper
- `server/services/groundingService.js` - PDF processing & retrieval

### Routes
- `server/routes/grounding.js` - Upload/manage documents

### Data Directory
- `server/data/grounding_pdfs/` - Stored PDF files

---

## 🔧 API Endpoints

### Upload Document
```
POST /api/grounding/upload
Content-Type: multipart/form-data

Form fields:
- pdf: File (required)
- title: String (optional, defaults to filename)
- topics: JSON array (optional, auto-suggested)
- bankTypes: JSON array (optional, auto-suggested)
- assetSizeRange: String (optional, defaults to 'all')
```

### List Documents
```
GET /api/grounding/documents
Query params:
- status: pending|processing|completed|failed
- topic: liquidity|capital|asset_quality|etc
- bankType: community|regional|large|mega
```

### Get Document Details
```
GET /api/grounding/documents/:id
```

### Update Document Metadata (Edit Tags)
```
PUT /api/grounding/documents/:id
Body:
{
  "title": "Updated Title",
  "topics": ["liquidity", "capital"],
  "bankTypes": ["regional", "large"]
}
```

### Delete Document
```
DELETE /api/grounding/documents/:id
```

### Test Vector Search (Debug)
```
POST /api/grounding/search
Body:
{
  "query": "how to analyze bank liquidity",
  "bankType": "regional",
  "topics": ["liquidity"],
  "limit": 5
}
```

---

## 📊 How Retrieval Works

### 1. Query Formation
When agent starts research:
```javascript
query = `Financial analysis best practices for ${bankType} banks.
         ${bankName} analysis approach, metrics interpretation.`
```

### 2. Filters Applied
- **No bank type filtering** - Grounding documents apply to all banks
- Optionally filter by topics (currently not used)

### 3. Vector Search (In-Memory)
- Query → Voyage AI embedding
- Load matching chunks from MongoDB
- Calculate cosine similarity in JavaScript
- Sort by score and retrieve top 5 chunks

### 4. Context Injection
Retrieved chunks added to prompt:
```
## Expert Grounding Documents

[Source 1] Bank Analysis Best Practices, p.23:
{chunk content}

[Source 2] Asset Quality Standards, p.15:
{chunk content}
...
```

### 5. Agent Uses Sources
Agent references: "According to industry standards [Source 1], the efficiency ratio..."

---

## 🏷️ Tagging System

### Topics (Editable)
- `liquidity` - Cash flow, funding, liquid assets
- `capital` - Capital ratios, equity, leverage
- `asset_quality` - NPLs, loan quality, credit risk
- `earnings` - Profitability, ROE, ROA, NIM
- `risk_management` - Risk controls, compliance
- `efficiency` - Operating efficiency, cost management
- `growth` - Expansion, market share
- `technology` - Digital transformation, fintech
- `strategy` - Strategic initiatives, planning
- `general` - Catch-all

### Bank Types (Optional - Not Currently Used for Filtering)
- `community` - <$1B assets
- `regional` - $1B-$10B assets
- `large` - $10B-$50B assets
- `mega` - >$50B assets
- `all` - Applies to all bank sizes

**Note:** Currently, all grounding documents apply to all banks regardless of type. The bank type tags are for organizational purposes only.

### Asset Size Ranges (Editable)
- `<100M`
- `100M-1B`
- `1B-10B`
- `10B-50B`
- `>50B`
- `all`

---

## 💡 Best Practices

### Document Selection
- **Start with 5-10 high-quality papers**
- Focus on authoritative sources (Fed, OCC, industry standards)
- Include both general principles and specific methodologies

### Tagging
- Be specific with topics - helps retrieval accuracy (when topic filtering is enabled)
- Bank types are optional - all documents apply to all banks
- Review auto-suggested tags and edit for accuracy

### Chunk Quality
- PDFs with clear structure chunk better
- Avoid scanned images without OCR
- Tables may not chunk perfectly (use text descriptions when possible)

### Testing
- Use the `/api/grounding/search` endpoint to test retrieval
- Check if relevant chunks are found for your queries
- Adjust tags if retrieval seems off

### Maintenance
- Monitor which documents are retrieved most (`timesRetrieved`)
- Update tags based on actual usage patterns
- Remove documents that are never retrieved

---

## 📈 Monitoring

### Document Stats
Each document tracks:
- `chunkCount` - Number of chunks created
- `timesRetrieved` - How often used in research
- `avgReportRating` - Average rating of reports using this doc
- `effectiveness` - Calculated effectiveness score

### Chunk Stats
Each chunk tracks:
- `retrievalCount` - Times retrieved
- `lastRetrievedAt` - When last used
- `avgRating` - Average rating when used in reports

---

## 🔍 Troubleshooting

### "No documents retrieved"
- Check that documents are `processingStatus: 'completed'`
- Check bank type filter matches document tags
- Verify chunks exist in the database

### "Voyage AI error"
- Verify `VOYAGE_API_KEY` in `.env`
- Check API key is valid at dashboard.voyageai.com

### "Slow retrieval performance"
- Normal for first query (loads all embeddings)
- For >10,000 chunks, consider upgrading to MongoDB Atlas with vector search
- Current in-memory approach works well for ~5,000 chunks

### "Processing stuck at 'processing'"
- Check server logs for errors
- Common issue: Voyage AI rate limits
- Solution: Reprocess with `/api/grounding/documents/:id/reprocess`

---

## 💰 Costs

### One-Time Setup (50 PDFs)
- 50 papers × 30 pages × 500 tokens = 750K tokens
- Voyage AI: 750K × $0.06/1M = **$0.045**

### Per Query
- Query embedding: ~100 tokens
- Cost: 100 × $0.06/1M = **$0.000006** (negligible)

### Storage
- MongoDB local: **$0**
- Each chunk: ~1KB embedding + text

**Total monthly cost for 1,000 reports: ~$0.01 in embedding costs**

---

## 🎯 Next Steps

1. **Upload your first PDF** - Use the admin interface at `/admin/grounding`
2. **Test search** - Use `/api/grounding/search` endpoint to verify retrieval
3. **Run agent research** - Should now cite sources!
4. **Add more documents** - Build your knowledge base over time

### Phase 2 (Optional - Not Yet Implemented)
- Feedback collection UI
- Learning loop (uses feedback to improve)
- Prompt caching (90% cost savings)
- Cohere reranking (30% accuracy improvement)

---

## 📞 Need Help?

Check:
1. Server logs for errors
2. MongoDB connection
3. Voyage AI API key validity
4. Document processing status

Common issues are usually:
- Documents stuck in "processing" status (check logs for Voyage AI errors)
- Invalid Voyage AI API key
- PDF processing errors (malformed PDFs)
