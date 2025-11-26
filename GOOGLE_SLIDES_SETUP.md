# Google Slides API Setup & Validation Guide

## Overview
This guide helps you validate that your Google Workspace allows programmatic access to Google Slides before we build the presentation generation feature.

---

## Step 1: Contact Your Google Workspace Admin

**Send this email to your admin:**

```
Subject: Request: Google Cloud Project for BankExplorer Presentation Feature

Hi [Admin Name],

I'm working on adding an automated presentation generation feature to our BankExplorer application. This would allow us to automatically create Google Slides presentations from financial research reports.

To implement this, I need to set up API access. Could you help me with the following?

Required Permissions:
1. Create a Google Cloud Project (or have you create one for me)
2. Enable these APIs:
   - Google Slides API
   - Google Drive API
3. Create a Service Account with credentials (or grant me permission to create one)
4. Ability for the service account to create presentations programmatically

Questions:
1. Can I create a Google Cloud Project under our organization?
2. Are Google Slides API and Google Drive API allowed in our organization?
3. Can I use service account authentication for server-side access?
4. Are there any organization policies that might restrict API-based presentation creation?
5. What are the API quota limits (standard is 300 requests/minute)?

Use Case:
- Server will automatically generate 15-20 slide presentations from research reports
- Presentations will include charts, key findings, and executive summaries
- Users will be able to download as PDF or access via Google Slides link
- Expected API usage: ~50-100 presentations per week

Please let me know if this is feasible or if there are any restrictions I should be aware of.

Thanks!
```

---

## Step 2: Google Cloud Setup (Once Approved)

### Option A: Admin Creates Everything (Recommended)

Ask your admin to:

1. **Create Google Cloud Project**
   - Name: "BankExplorer-Presentations"
   - Organization: Your company's Google Workspace

2. **Enable APIs**
   - Google Slides API
   - Google Drive API

3. **Create Service Account**
   - Name: "bankexplorer-slides-service"
   - Grant role: "Editor" or "Owner"
   - Create JSON key file
   - Share JSON file with you securely (NOT via email - use secure file transfer)

4. **Provide You With**
   - Service account email (e.g., `bankexplorer-slides-service@project-id.iam.gserviceaccount.com`)
   - JSON credentials file
   - Project ID

### Option B: You Create It Yourself (If You Have Permissions)

1. **Go to Google Cloud Console**
   - URL: https://console.cloud.google.com
   - Sign in with your work Google account

2. **Create New Project**
   - Click "Select a project" → "New Project"
   - Name: "BankExplorer-Presentations"
   - Organization: Select your company
   - Click "Create"

3. **Enable APIs**
   - Go to "APIs & Services" → "Library"
   - Search for "Google Slides API" → Click → "Enable"
   - Search for "Google Drive API" → Click → "Enable"

4. **Create Service Account**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Name: "bankexplorer-slides-service"
   - Role: "Editor"
   - Click "Done"

5. **Download Credentials**
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Choose "JSON"
   - Save the file (it will download automatically)

---

## Step 3: Install Dependencies & Prepare Test

1. **Install Google APIs Package**
   ```bash
   cd /Users/gjacobi/BankExplorer/Banks
   npm install googleapis
   ```

2. **Create Config Directory**
   ```bash
   mkdir -p server/config
   ```

3. **Save Credentials File**
   - Rename the downloaded JSON file to: `google-credentials.json`
   - Move it to: `/Users/gjacobi/BankExplorer/Banks/server/config/google-credentials.json`

4. **Add to .gitignore**
   ```bash
   echo "server/config/google-credentials.json" >> .gitignore
   ```

5. **Verify File Location**
   ```bash
   ls -la server/config/google-credentials.json
   ```
   You should see the file listed.

---

## Step 4: Run Validation Test

Run the test script to verify everything works:

```bash
cd /Users/gjacobi/BankExplorer/Banks
node test_google_slides_access.js
```

### Expected Output (Success):

```
=== Google Slides API Access Test ===

Step 1: Checking credentials file...
✓ Credentials file found

Step 2: Loading credentials...
✓ Credentials loaded successfully
  Service account email: bankexplorer-slides-service@project-id.iam.gserviceaccount.com

Step 3: Authenticating with Google...
✓ Authentication successful

Step 4: Testing Google Slides API access...
  Creating test presentation...
✓ Test presentation created
  Presentation ID: 1a2b3c4d5e6f7g8h9i0j
  URL: https://docs.google.com/presentation/d/1a2b3c4d5e6f7g8h9i0j

Step 5: Testing content insertion...
✓ Successfully added text to slide

Step 6: Testing PDF export...
✓ PDF export successful

Step 8: Cleaning up test files...
✓ Test presentation deleted

=== TEST RESULTS: SUCCESS ===

✓ All core functionality works!
```

### Common Error Messages:

**Error: Credentials file not found**
```
✗ FAILED: Credentials file not found at: server/config/google-credentials.json
```
**Fix**: Make sure you saved the credentials file in the correct location.

---

**Error: 403 Forbidden**
```
✗ FAILED: The caller does not have permission
```
**Fix**: This means one of:
1. Google Slides API not enabled → Ask admin to enable it
2. Service account lacks permissions → Ask admin to grant "Editor" role
3. Organization policy blocks API access → Admin needs to update policies

---

**Error: 429 Rate Limit**
```
✗ FAILED: Quota exceeded
```
**Fix**: Wait 1 minute and try again. If it persists, ask admin about API quotas.

---

**Error: Invalid credentials**
```
✗ FAILED: Authentication error
```
**Fix**:
1. Make sure JSON file is valid (open in text editor, check for errors)
2. Verify it's a service account key (not OAuth client credentials)
3. Re-download credentials from Google Cloud Console

---

## Step 5: Create Test Template (Optional)

Once the test script passes, create a template to test copying:

1. **Create Template in Google Slides**
   - Go to https://slides.google.com
   - Create a new presentation
   - Name it: "BankExplorer Template - Test"
   - Add a few slides with placeholder text: `{{BANK_NAME}}`, `{{DATE}}`, etc.
   - Get the presentation ID from the URL:
     - URL: `https://docs.google.com/presentation/d/PRESENTATION_ID_HERE/edit`
     - Copy the `PRESENTATION_ID_HERE` part

2. **Share Template with Service Account**
   - In Google Slides, click "Share"
   - Add the service account email (from credentials file)
   - Give it "Editor" access
   - Click "Done"

3. **Test Template Copying**
   - Edit `test_google_slides_access.js`
   - Find line: `const TEST_TEMPLATE_ID = '';`
   - Replace with: `const TEST_TEMPLATE_ID = 'YOUR_PRESENTATION_ID_HERE';`
   - Run test again: `node test_google_slides_access.js`
   - Should see: `✓ Template copied successfully`

---

## Step 6: Report Results

Once you've run the test, report back:

**If Test Passes ✓**
- We're good to proceed with full implementation!
- No blockers from Google Workspace side

**If Test Fails ✗**
- Share the error message
- I'll help troubleshoot or propose alternative approaches

---

## Alternative Approaches (If Google Slides is Blocked)

If your organization doesn't allow Google Slides API access, we have fallback options:

### Alternative 1: PowerPoint Generation (pptxgenjs)
- Generate .pptx files server-side
- Users download PowerPoint file
- No Google API needed
- **Pros**: No permissions needed, works offline
- **Cons**: No web preview, must download file

### Alternative 2: PDF Presentation (PDFKit)
- Generate PDF "slide deck"
- Similar visual to PowerPoint
- **Pros**: Universal format, no special permissions
- **Cons**: Not editable, no templates

### Alternative 3: HTML Presentation (Reveal.js)
- Generate HTML-based presentation
- Looks like slides, works in browser
- **Pros**: No external APIs, highly customizable
- **Cons**: Less professional, no standard format

---

## Security Best Practices

**DO:**
- ✓ Store credentials in `server/config/` (already in .gitignore)
- ✓ Use environment variables for credentials path
- ✓ Restrict service account to minimum necessary permissions
- ✓ Rotate credentials every 90 days

**DON'T:**
- ✗ Commit credentials to git
- ✗ Share credentials via email or Slack
- ✗ Use your personal Google account for service account

---

## Next Steps After Validation

Once test passes, we'll:
1. Update constitution for more concise reports (30 min)
2. Fix podcast generation logging (15 min)
3. Build PresentationService with chart generation (Week 1-2)
4. Create API endpoints and frontend UI (Week 2-3)
5. Test with real bank data (Week 3)

---

## Questions?

If you have any questions or run into issues:
1. Check error messages in test script output
2. Review "Common Error Messages" section above
3. Ask me for help troubleshooting
4. Contact your Google Workspace admin if it's a permissions issue
