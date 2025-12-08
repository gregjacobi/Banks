# Test RAG Delete from Browser Console

## Quick Test

Open your browser console (F12 → Console) and run this code to test the delete endpoint directly:

```javascript
// Replace '761806' with the actual idrssd for Webster Bank
const idrssd = '761806';

console.log('Testing DELETE /api/research/' + idrssd + '/delete-rag');

fetch('/api/research/' + idrssd + '/delete-rag', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('Response status:', response.status);
  console.log('Response OK:', response.ok);
  return response.json();
})
.then(data => {
  console.log('SUCCESS! Response data:', data);
  alert('Delete succeeded!\n' + JSON.stringify(data, null, 2));
})
.catch(error => {
  console.error('FAILED! Error:', error);
  alert('Delete failed!\n' + error.message);
});
```

## What to Look For

### Success Scenario:
```
Response status: 200
Response OK: true
SUCCESS! Response data: {
  success: true,
  message: "Successfully deleted RAG environment",
  deletedDocuments: 2,
  deletedChunks: 265,
  resetPDFs: 2,
  errors: 0
}
```

### Failure Scenarios:

#### 1. Network Error (Request doesn't reach server)
```
FAILED! Error: Failed to fetch
```
**Cause:** Server is down, CORS issue, or network problem
**Fix:** Check if server is running on port 5001

#### 2. 404 Not Found
```
Response status: 404
```
**Cause:** Wrong URL or route not registered
**Fix:** Check server routes are loaded

#### 3. 500 Server Error
```
Response status: 500
Response data: { error: "Failed to delete RAG environment: [error]" }
```
**Cause:** Server-side error (check server logs)

## Check idrssd

If you're not sure what the idrssd is, run this first:

```javascript
// Get current bank from the page
const url = window.location.pathname;
const idrssdMatch = url.match(/\/bank\/(\d+)/);
if (idrssdMatch) {
  const idrssd = idrssdMatch[1];
  console.log('Current bank idrssd:', idrssd);
} else {
  console.log('Not on a bank detail page');
}
```

## Full Debug Test

Run this for comprehensive debugging:

```javascript
async function testDeleteRAG() {
  // Get idrssd from URL
  const url = window.location.pathname;
  const idrssdMatch = url.match(/\/bank\/(\d+)/);

  if (!idrssdMatch) {
    console.error('ERROR: Not on a bank detail page');
    return;
  }

  const idrssd = idrssdMatch[1];
  const endpoint = `/api/research/${idrssd}/delete-rag`;

  console.log('='.repeat(50));
  console.log('Testing RAG Delete');
  console.log('='.repeat(50));
  console.log('Bank idrssd:', idrssd);
  console.log('Endpoint:', endpoint);
  console.log('Timestamp:', new Date().toISOString());
  console.log('');

  try {
    console.log('Sending DELETE request...');
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Response received!');
    console.log('  Status:', response.status);
    console.log('  Status Text:', response.statusText);
    console.log('  OK:', response.ok);
    console.log('  Headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('  Body:', data);

    if (response.ok) {
      console.log('');
      console.log('✅ DELETE SUCCEEDED');
      console.log('='.repeat(50));
      alert('RAG Delete Succeeded!\n\n' + JSON.stringify(data, null, 2));
      return data;
    } else {
      console.log('');
      console.log('❌ DELETE FAILED (HTTP ' + response.status + ')');
      console.log('='.repeat(50));
      alert('RAG Delete Failed!\n\n' + JSON.stringify(data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('');
    console.log('❌ REQUEST FAILED');
    console.log('='.repeat(50));
    console.error('Error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    alert('Request Failed!\n\n' + error.message);
    throw error;
  }
}

// Run the test
testDeleteRAG();
```

## Expected Output

When you run this test, you should see detailed output in the console that will help identify exactly where the problem is.

**Check the server terminal/logs at the same time** - you should see the detailed DELETE RAG logs we added.

## Troubleshooting

### Problem: "Failed to fetch" error
- Server is not running
- Server is on wrong port
- CORS issue
- Network disconnected

### Problem: 404 Not Found
- Route not registered in server
- Server didn't load the route file
- URL is malformed

### Problem: 500 Server Error
- Check server logs for the error
- Database connection issue
- Permission issue deleting files

### Problem: Request succeeds but UI still shows error
- The deleteRAG function in AIContext might be catching an error from one of the reload functions
- The new code I added will now treat reload errors as non-fatal
