# Render Deployment with Data Import Guide

This guide walks you through deploying your Bank Explorer app to Render and then importing FFIEC Call Report data into your MongoDB Atlas database.

## Part 1: Deploy to Render

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up or log in (can use GitHub login)

### Step 2: Create New Web Service
1. Click **"New +"** button → Select **"Web Service"**
2. Connect your GitHub account if not already connected
3. Select repository: **gregjacobi/Banks**
4. Select branch: **claude/incomplete-description-011CV2hCUxtvqsrU7MUdYZtX**

### Step 3: Configure Service
Render will auto-detect your `render.yaml` configuration, but verify these settings:

- **Name**: `bank-explorer` (or your preferred name)
- **Environment**: `Node`
- **Build Command**: `npm install && cd client && npm install && npm run build`
- **Start Command**: `npm start`
- **Plan**: `Free` (or upgrade to paid)

### Step 4: Add Environment Variables

In the Render dashboard, go to **Environment** tab and add:

| Key | Value |
|-----|-------|
| `MONGODB_URI` | Your MongoDB Atlas connection string (see Step 1) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (from https://console.anthropic.com/) |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |

**Note**: Use your actual values obtained from:
- MongoDB Atlas connection string from Step 1 (format: `mongodb+srv://username:password@cluster.mongodb.net/`)
- Anthropic API key from your Anthropic console

Click **"Save Changes"** - this will trigger the first deployment.

### Step 5: Wait for Initial Deployment
- First deployment takes 5-10 minutes
- Watch the logs in the Render dashboard
- Once complete, you'll see a green checkmark and your app URL

### Step 6: Verify Deployment
Visit your app URL (e.g., `https://bank-explorer.onrender.com`)
- Check health endpoint: `https://your-app.onrender.com/api/health`
- You should see: `{"status":"OK","database":"Connected"}`

**Note**: The app is now live but has NO data in the database yet.

---

## Part 2: Import Data on Render

Now we'll use Render's shell access to download and import the FFIEC data directly on the server.

### Step 7: Access Render Shell

**Option A: Using Render Dashboard (Easier)**
1. Go to your service in Render dashboard
2. Click the **"Shell"** tab
3. This opens a web-based terminal connected to your server

**Option B: Using Render CLI (Advanced)**
```bash
# Install Render CLI locally
npm install -g @render/cli

# Login to Render
render login

# Connect to shell
render shell bank-explorer
```

### Step 8: Download Call Report Data

In the Render shell, run:

```bash
# Download data for Q1 2023 through Q2 2025 (10 quarters)
node scripts/downloadCallReports.js 2023-Q1 2025-Q2

# Or use the convenient npm script:
npm run download-all
```

This will:
- Download ~200-300 MB per quarter
- Take about 10-15 minutes for all 10 quarters
- Extract files automatically
- Place them in `/opt/render/project/src/data/`

**Progress indicators:**
```
📅 Downloading 10 quarters of data from 2023 Q1 to 2025 Q2...

⬇️  2023 Q1 - Downloading...
   2023 Q1 - Downloaded (250.45 MB)
📦 2023 Q1 - Extracting...
✓ 2023 Q1 - Extracted successfully
...
```

**Note**: If you want to download only recent quarters (faster):
```bash
# Download just last 4 quarters (2024 Q3 - 2025 Q2)
node scripts/downloadCallReports.js 2024-Q3 2025-Q2
```

### Step 9: Import Data into MongoDB

Once download completes, run the import script:

```bash
# Import all quarters that were downloaded
node scripts/importAllQuarters.js
```

This will:
- Take 30-60 minutes for 10 quarters
- Process ~4,500 banks per quarter
- Import ~46,000 financial statements total
- Connect directly to your MongoDB Atlas database

**Progress indicators:**
```
✓ Connected to MongoDB

================================================================================
📅 Processing Quarter: 2023-03-31
================================================================================

📖 Parsing Schedule POR (Bank Information)...
✓ Found 4723 banks

📖 Parsing Schedule RC (Balance Sheet)...
✓ Parsed 4724 balance sheets

💾 Importing data to MongoDB...
  Processed 500 statements...
  Processed 1000 statements...
  ...

✅ Quarter 2023-03-31 Complete!
   Institutions: 4723
   Financial Statements: 4723
   Validation Errors: 107
```

### Step 10: Verify Import Success

Check that data was imported successfully:

```bash
# Quick verification - count documents
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Institution = require('./server/models/Institution');
  const FinancialStatement = require('./server/models/FinancialStatement');
  const instCount = await Institution.countDocuments();
  const stmtCount = await FinancialStatement.countDocuments();
  console.log('Institutions:', instCount);
  console.log('Financial Statements:', stmtCount);
  process.exit(0);
});
"
```

Expected output:
```
Institutions: ~4500
Financial Statements: ~46000 (for 10 quarters)
```

### Step 11: Test Your App

Visit your app and try:
1. Searching for a bank (e.g., "Wells Fargo")
2. Viewing financial statements
3. Running analysis features

Your app is now fully deployed and populated with data!

---

## Troubleshooting

### Shell Session Timeout
Render free tier shells timeout after 30 minutes. If this happens during download:
- The download script resumes automatically (skips already downloaded quarters)
- Just run the same command again

### Out of Disk Space
If you run out of disk space on Render:
- Download fewer quarters at a time
- Delete ZIP files manually: `rm data/*.zip`
- Or upgrade to paid plan with more storage

### Network Errors During Download
The script automatically skips failed downloads and continues. If downloads fail:
```bash
# Retry just failed quarters
node scripts/downloadCallReports.js 2024-Q1 2024-Q1  # Single quarter
```

### MongoDB Connection Errors
Verify your MongoDB Atlas network access:
1. Go to MongoDB Atlas dashboard
2. Click "Network Access"
3. Add IP: `0.0.0.0/0` (allow from anywhere)
4. Or add Render's specific IPs for better security

### Import Script Fails
Check the error message:
- **"Cannot find module"**: Run `npm install` first
- **"ENOENT: no such file"**: Data files not downloaded yet
- **"MongoNetworkError"**: Check MongoDB Atlas connection settings

---

## Cost Considerations

### Free Tier
- Render Free: $0/month (service spins down after 15 minutes inactivity)
- MongoDB Atlas Free: $0/month (512 MB storage, ~60K documents)
- Total: **$0/month**

**Limitations**:
- First request after spin-down takes 30-60 seconds
- 512 MB storage limit may be exceeded with 10 quarters of data

### Recommended for Production
- Render Starter: $7/month (always-on, 512 MB RAM)
- MongoDB Atlas M2: $9/month (2 GB storage)
- Total: **$16/month**

---

## Alternative: Import Fewer Quarters

If you're hitting MongoDB Atlas free tier limits (512 MB), import fewer quarters:

```bash
# Option 1: Last 4 quarters only (~18K statements)
node scripts/downloadCallReports.js 2024-Q3 2025-Q2
node scripts/importAllQuarters.js

# Option 2: Last 2 quarters only (~9K statements)
node scripts/downloadCallReports.js 2025-Q1 2025-Q2
node scripts/importAllQuarters.js
```

You can always import more data later when you upgrade MongoDB.

---

## Maintenance

### Update Data with New Quarters

When new quarterly data is released (quarterly on Mar 31, Jun 30, Sep 30, Dec 31):

```bash
# Open Render shell
render shell bank-explorer

# Download just the new quarter
node scripts/downloadCallReports.js 2025-Q3 2025-Q3

# Re-run import (it will skip existing quarters)
node scripts/importAllQuarters.js
```

### Clear and Reimport Data

If you need to start fresh:

```bash
# Connect to MongoDB and clear collections
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Institution = require('./server/models/Institution');
  const FinancialStatement = require('./server/models/FinancialStatement');
  await Institution.deleteMany({});
  await FinancialStatement.deleteMany({});
  console.log('✓ All data cleared');
  process.exit(0);
});
"

# Then re-import
node scripts/importAllQuarters.js
```

---

## Success Checklist

- [ ] App deployed to Render
- [ ] Environment variables configured
- [ ] App accessible via Render URL
- [ ] Health check shows database connected
- [ ] Data downloaded (10 quarters)
- [ ] Data imported to MongoDB Atlas
- [ ] Can search and view banks in app
- [ ] All features working correctly

**Congratulations! Your Bank Explorer app is fully deployed and operational!** 🎉

---

## Appendix: NPM Scripts Reference

Convenient npm scripts for data management:

```bash
# Download all quarters (Q1 2023 - Q2 2025)
npm run download-all

# Download only recent quarters (Q3 2024 - Q2 2025)
npm run download-recent

# Download with custom date range
npm run download-data 2024-Q1 2024-Q4

# Import all downloaded quarters
npm run import-data

# Complete setup: download + import in one command
npm run setup-data
```

These scripts are defined in `package.json` and make it easier to manage data on Render.
