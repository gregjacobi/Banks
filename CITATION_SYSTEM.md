# Citation System Implementation

## Overview

Implemented a comprehensive citation tracking system similar to research papers for strategic priority gathering and KPIs. This system uses Anthropic's new **Citations API** (launched January 2025) to provide research-grade citation tracking with links to source materials and methodology explanations.

## Features Implemented

### 1. **Citations API Integration** (server/routes/research.js:4191-4412)

The extract-insights endpoint now uses Claude's Citations API to:
- Enable citation tracking on all document blocks
- Capture exact passages from source documents that support each insight
- Track page numbers and document titles
- Automatically link insights to their source citations

**Key Changes:**
- Documents are sent to Claude as `document` blocks with `citations: { enabled: true }`
- Response includes citation metadata with:
  - `documentTitle`: Title of source document
  - `citedText`: Exact quoted text from the document
  - `pageNumber`: Page reference (for PDFs)
  - `documentUrl`: API endpoint to access the PDF

### 2. **Enhanced Data Model** (server/models/BankMetadata.js:121-273)

Updated `strategicInsights` schema to include:

**For each priority/metric/partnership:**
- `citations[]`: Array of citation objects containing:
  - `documentTitle`: Source document name
  - `documentUrl`: Link to access the document
  - `citedText`: Exact quoted passage
  - `locationType`: Type of reference (page/char/block)
  - `pageNumber`: Page number (for PDFs)
  - `startChar/endChar`: Character indices (for text)
- `methodology`: Brief explanation of how this insight was determined

**Overall methodology:**
- `extractionMethodology`: Comprehensive explanation of the extraction process, including:
  - Number of documents analyzed
  - Tools used (Citations API, RAG)
  - How insights were grounded in source material

### 3. **Research-Grade UI** (client/src/components/StrategicOverview.jsx)

**New Components:**

#### `Citation` Component (lines 32-109)
- Displays individual citations with clickable links
- Shows document title and page number
- Expandable quoted text (click quote icon to reveal)
- Color-coded with Anthropic brand colors (#d97757)

#### `CitationsList` Component (lines 115-128)
- Displays all citations for an insight
- Numbered citation format: [1], [2], etc.
- Separated from main content with visual divider

#### `Methodology` Component (lines 134-145)
- Shows how each insight was determined
- Icon-based design for quick scanning
- Italicized for visual distinction

**Enhanced Sections:**
- **Strategic Priorities**: Now shows methodology + citations for each priority
- **Focus Metrics**: Now shows methodology + citations for each metric
- **Technology Partnerships**: Now shows methodology + citations for each partnership
- **Research Methodology Section**: New dedicated section explaining:
  - How many documents were analyzed
  - What tools were used
  - When the extraction was performed

## Usage Example

### Backend (extract-insights endpoint):

```javascript
// Documents are formatted with citations enabled
documentBlocks.push({
  type: 'document',
  source: {
    type: 'text',
    media_type: 'text/plain',
    data: chunk.content
  },
  citations: { enabled: true },
  title: chunk.documentTitle
});

// Response includes citations
const insights = {
  priorities: [{
    title: "Digital Banking Transformation",
    description: "...",
    methodology: "CEO mentioned this as 'top priority' in Q3 2024 earnings call",
    citations: [{
      documentTitle: "Q3 2024 Earnings Transcript",
      documentUrl: "/api/research/grounding/documents/abc123/pdf",
      citedText: "Our digital banking platform is our number one strategic priority...",
      pageNumber: 5,
      locationType: "page"
    }]
  }]
};
```

### Frontend (StrategicOverview component):

```jsx
<Card>
  <CardContent>
    <Typography variant="subtitle1">{priority.title}</Typography>
    <Typography variant="body2">{priority.description}</Typography>

    {/* Methodology explanation */}
    <Methodology text={priority.methodology} />

    {/* Citations with links */}
    <CitationsList citations={priority.citations} />
  </CardContent>
</Card>
```

## User Experience

1. **Clickable Citations**: Each citation is a clickable link that opens the source PDF
2. **Expandable Quotes**: Click the quote icon (📝) to see the exact text that was cited
3. **Methodology Transparency**: Each insight shows how it was determined
4. **Overall Methodology**: Section explaining the research process and tools used
5. **Research Paper Style**: Numbered citations ([1], [2]) like academic papers

## API Requirements

**Claude API Version**: Requires `@anthropic-ai/sdk` v0.67.0+ (already installed)

**Model Support**: Citations API is supported on:
- Claude 3.5 Sonnet (claude-sonnet-4-5-20250929) ✅ Currently using
- Claude 3.5 Haiku

## Example Output in UI

```
Strategic Priority: Digital Banking Transformation

Focus on modernizing core banking systems and expanding digital channels to serve remote customers.

ℹ️ Methodology: CEO mentioned this as 'top priority' 3 times in Q3 2024 earnings call

Sources:
[1] Q3 2024 Earnings Transcript, p.5 🔗
    (click 📝 to expand quoted text)
[2] 2024 Investor Presentation, p.12 🔗
```

## Benefits

1. **Trustworthy**: Users can verify every insight by reading the source
2. **Transparent**: Clear explanation of how insights were determined
3. **Professional**: Research-grade citations like academic papers
4. **Accessible**: One-click access to source documents
5. **Auditable**: Full citation chain from insight to source passage

## Next Steps (Optional)

- **AgentOrchestrator Updates**: Update agentOrchestrator.js to also use Citations API when generating research reports (currently only extract-insights endpoint uses it)
- **PDF Viewer**: Add in-app PDF viewer to show cited page without leaving the app
- **Citation Search**: Allow users to search by citation or source document
- **Export Citations**: Export insights with citations in academic formats (BibTeX, APA, etc.)

## Files Modified

1. `server/models/BankMetadata.js` - Added citation fields to schema
2. `server/routes/research.js` - Integrated Citations API (lines 4191-4412)
3. `client/src/components/StrategicOverview.jsx` - Added citation display components

## Testing

To test the citation system:

1. Upload PDFs for a bank in the AI Research tab
2. Click "Extract Strategic Insights"
3. View the Strategic Overview tab
4. Look for:
   - Citation links under each insight
   - Methodology explanations with info icons
   - Research Methodology section at the bottom
   - Expandable quoted text (click quote icons)

## References

- [Anthropic Citations API Announcement](https://www.anthropic.com/news/introducing-citations-api)
- [Citations API Documentation](https://docs.claude.com/en/docs/build-with-claude/citations)
- Anthropic SDK: `@anthropic-ai/sdk` v0.67.0+
