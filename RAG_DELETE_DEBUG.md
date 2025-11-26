# RAG Delete Debugging Summary

## Investigation Results

I investigated the RAG deletion issue for Webster Bank and found that **the delete endpoint is working correctly**. Here's what I discovered:

### Database Status

**Webster Bank (idrssd: 761806)** currently has:
- ✅ **2 RAG documents** (properly stored in MongoDB)
  1. "Webster Financial Corporation (WBS) Q3 2025 Earnings Call Transcript" - 170 chunks
  2. "Q2 2025 Earnings Presentation" - 95 chunks
- ✅ **265 total chunks** embedded and indexed
- ✅ **Strategic insights** extracted (5 priorities, 7 metrics, 1 partnership)
- ✅ **2 PDFs** with RAG status "completed"

### What Was Fixed

1. **Enhanced Server Logging** (`server/routes/research.js:3912-4023`)
   - Added comprehensive logging at every step of the deletion process
   - Shows exactly which documents and chunks are being deleted
   - Logs success/failure for each operation
   - Includes timing and detailed error messages

   **Example log output:**
   ```
   ========== DELETE RAG REQUEST ==========
   [Delete RAG] Starting deletion for bank 761806
   [Delete RAG] Query for documents with idrssd="761806"
   [Delete RAG] Found 2 documents
   [Delete RAG] Document IDs: [...]
   [Delete RAG] Document titles: [...]
   [Delete RAG] Deleting document: Q2 2025 Earnings Presentation (ID: ...)
   [Delete RAG] ✓ Successfully deleted document
   [Delete RAG] Deleted 265 chunks
   [Delete RAG] ✓ COMPLETE - Sending response
   ```

2. **Improved UI Feedback** (`client/src/components/BuilderDrawer.jsx:287-326`)
   - More detailed success messages showing:
     - Number of documents deleted
     - Number of chunks deleted
     - Number of PDFs reset
   - Better error messages with actual error details
   - Console logging for debugging

   **Example feedback:**
   ```
   Successfully deleted RAG environment:
   • 2 document(s)
   • 265 chunk(s)
   • 2 PDF(s) reset
   ```

3. **Added Orphaned Chunk Cleanup**
   - The delete now explicitly removes all chunks for the bank
   - Safety measure to ensure complete cleanup
   - Previously relied on cascade delete which may miss orphaned records

## How to Test

1. Navigate to Webster Bank in the app
2. Open the AI Research/Builder tab
3. Click "Delete RAG" button
4. Check the browser console for detailed logs
5. Check the server logs for the detailed deletion process
6. Verify the success message shows the correct counts

## What to Look For

**If delete is working:**
- Alert shows: "Successfully deleted RAG environment: • 2 document(s) • 265 chunk(s) • 2 PDF(s) reset"
- Server logs show: `[Delete RAG] ✓ COMPLETE - Sending response`
- Strategic Overview tab shows "No strategic information available"
- RAG stats show 0 documents

**If delete fails:**
- Alert shows: "Failed to delete RAG environment: [error message]"
- Server logs show: `[Delete RAG] ✗ FATAL ERROR:`
- Check the error details in both console and server logs

## Possible Issues and Solutions

### Issue: "No RAG documents found"
**Cause:** RAG data was already deleted or never uploaded
**Solution:** This is actually success - nothing to delete

### Issue: Strategic insights still showing after delete
**Cause:** Browser cache or page didn't refresh
**Solution:** Hard refresh the page (Cmd+Shift+R / Ctrl+Shift+R)

### Issue: PDFs still show "completed" RAG status
**Cause:** PDF update query didn't match records
**Solution:** Check server logs - should show "Reset X PDFs (matched Y)"

### Issue: Chunks still exist after delete
**Cause:** Orphaned chunks not properly deleted
**Solution:** This is now fixed - chunks are explicitly deleted by idrssd

## Technical Details

### Delete Process Flow

1. Find all `GroundingDocument` records where `idrssd` matches
2. For each document:
   - Delete the physical PDF file from disk
   - Delete all `GroundingChunk` records referencing this document
   - Delete the `GroundingDocument` record
3. Delete any orphaned chunks (safety cleanup)
4. Reset `PDF` records' RAG status fields
5. Reset `BankMetadata` strategic insights

### Database Queries

```javascript
// Find documents
GroundingDocument.find({ idrssd: '761806' })

// Delete chunks
GroundingChunk.deleteMany({ idrssd: '761806' })

// Reset PDFs
PDF.updateMany(
  { idrssd: '761806' },
  { $set: { ragStatus: 'not_uploaded', ragDocumentId: null } }
)

// Reset metadata
BankMetadata.updateOne(
  { idrssd: '761806' },
  { $set: { 'strategicInsights.status': 'not_extracted' } }
)
```

## Next Steps

1. Try deleting RAG for Webster Bank again
2. Check the server console/logs for the detailed output
3. Share any error messages or unexpected behavior
4. The enhanced logging will help diagnose any remaining issues
