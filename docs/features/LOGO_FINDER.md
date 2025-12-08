# Logo Finder CLI Tool

A command-line tool for finding and downloading bank logos with extensive verbose logging to help improve logo discovery strategies.

## Overview

The Logo Finder uses the Brandfetch API to discover bank logos from their CDN service. Brandfetch maintains a comprehensive database of company logos and brand assets. The tool provides extremely detailed logging to help analyze and improve the search strategy.

## Location

The script is located at:
```
server/scripts/cli/findLogos.js
```

## Prerequisites

- MongoDB running
- Server dependencies installed (`npm install`)
- Environment variables configured (`.env` file with `MONGODB_URI`)
- Brandfetch Client ID: `1idTnzC8NoUWbexbAFL` (already configured in script)

## Usage

### Find Logo for Specific Bank by ID

```bash
node server/scripts/cli/findLogos.js --idrssd 504713
```

### Find Logo for Specific Bank by Name

```bash
node server/scripts/cli/findLogos.js --name "JPMorgan Chase Bank"
```

### Find Logos for Top N Banks

```bash
# Process top 10 banks
node server/scripts/cli/findLogos.js --count 10
```

### Force Re-find Logos

If a bank already has a logo, you can force it to re-find:

```bash
node server/scripts/cli/findLogos.js --count 10 --force
```

**What happens during force re-find:**
- Re-searches for the logo even if one exists
- Replaces existing logo in database
- Downloads new logo file
- Logs all search attempts and strategies

### List Logo Status

View which banks have logos and which don't:

```bash
node server/scripts/cli/findLogos.js --list --count 20
```

Output example:
```
📊 Banks with Logo Status

====================================================================================================
ID RSSD     Bank Name                                          Assets          Logo
====================================================================================================
504713      JPMORGAN CHASE BANK, NATIONAL ASSOCIATION          $3.2T           ✅ (Wikipedia)
852218      TRUIST BANK                                        $392.4B         ✅ (Official website)
413208      WEBSTER BANK, NATIONAL ASSOCIATION                 $75.2B          ❌
====================================================================================================
```

## Command Line Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--idrssd` | `-i` | Bank ID (IDRSSD) | - |
| `--name` | `-n` | Bank name (partial match) | - |
| `--count` | `-c` | Number of top banks to process | 1 |
| `--list` | `-l` | List banks with logo status | false |
| `--force` | `-f` | Re-find logos even if they exist | false |

## Verbose Logging

The tool provides extremely detailed logging at every step:

### Log Types

- 🏦 **Section Headers**: Major workflow sections
- 📝 **Prompts**: Full prompts sent to Claude
- 🤖 **Responses**: Full responses from Claude
- ✅ **Success**: Successful operations
- ❌ **Errors**: Failed operations
- ⚠️  **Warnings**: Important notices
- ℹ️  **Info**: General information
- 🔍 **Debug**: Detailed debug data (JSON objects)

### Example Output

```
================================================================================
🏦 JPMORGAN CHASE BANK, NATIONAL ASSOCIATION (504713)
================================================================================
  ℹ️  Location: COLUMBUS, OH
  ℹ️  Assets: $3.2T

[STEP 1] Generating domain variations for Brandfetch search
  🔍 Domain variations to try:
     [
       "jpmorganchase.com",
       "jpmorganchasebank.com",
       "jpmorgan.com",
       "chase.com"
     ]

[STEP 2] Searching Brandfetch for logo
  ℹ️  Trying domain: jpmorganchase.com
  🔍 ✗ jpmorganchase.com/logo.svg - 404
  🔍 ✗ jpmorganchase.com/logo.png - 404
  🔍 ✗ jpmorganchase.com/symbol.svg - 404
  ℹ️  Trying domain: jpmorgan.com
  🔍 ✗ jpmorgan.com/logo.svg - 404
  ℹ️  Trying domain: chase.com
  ✅ ✓ Found logo: chase.com/logo.svg
  🔍 Logo details:
     {
       "domain": "chase.com",
       "logoType": "logo",
       "format": "svg",
       "size": "12.05 KB",
       "contentType": "image/svg+xml"
     }

[STEP 3] Logo found! Preparing for validation
  ✅ Logo URL: https://cdn.brandfetch.io/chase.com/logo.svg?c=1idTnzC8NoUWbexbAFL
  ℹ️  Source: Brandfetch (chase.com)
  ℹ️  Type: logo, Format: svg
  ℹ️  Size: 12.05 KB

[STEP 4] Saving logo URL to database
  ✅ Logo URL saved to database

[STEP 5] Validating and saving logo file
  ℹ️  Logo already downloaded from Brandfetch, validating...
  ✅ ✓ File size OK: 12.05 KB
  ✅ ✓ Content type OK: image/svg+xml
  ✅ ✓ File signature valid: SVG
  ✅ ✓ No error page indicators found

[STEP 6] Writing file to disk
  ✅ File written: /path/to/logos/504713.svg

[STEP 7] Verifying written file
  ✅ ✓ File size verified: 12345 bytes
  ✅ ✓ File readback successful
  ✅ ✓ File is readable

[STEP 8] Updating database with validated logo
  ✅ Database updated with validated logo

================================================================================
✅ LOGO VALIDATION PASSED
================================================================================
```

## Logo Validation Process

After finding a logo URL, the tool performs **7 comprehensive validation checks** to ensure the logo is legitimate and usable:

### Validation Steps

1. **File Size Check**
   - Minimum: 0.5 KB (rejects placeholder/error pages)
   - Maximum: 10 MB (rejects oversized files)
   - Warning if > 5 MB (may not be a logo)

2. **Content Type Validation**
   - Verifies HTTP Content-Type header
   - Accepts: SVG, PNG, JPEG, JPG, WebP
   - Rejects: HTML, text, or other non-image types

3. **File Signature Analysis (Magic Bytes)**
   - SVG: Checks for `<svg` tag in first 100 bytes
   - PNG: Verifies PNG signature (89 50 4E 47)
   - JPEG: Verifies JPEG signature (FF D8 FF)
   - Warns if signature is inconclusive

4. **Error Page Detection**
   - Scans first 500 bytes for error indicators
   - Rejects files containing: "404", "not found", "error", "access denied", "forbidden"
   - Prevents downloading error pages that look like images

5. **File Write Verification**
   - Confirms file written to disk successfully
   - Verifies written file size matches downloaded size
   - Detects disk write failures

6. **Readback Verification**
   - Reads the file back from disk
   - Confirms readback size matches original
   - Ensures file integrity

7. **Permission Check**
   - Verifies file has read permissions
   - Ensures app can access the logo
   - Confirms file is usable by the application

### Validation Success

```
[STEP 9] Validating downloaded file
  ✅ ✓ File size OK: 12.05 KB
  ✅ ✓ Content type OK: image/svg+xml
  ✅ ✓ File signature valid: SVG
  ✅ ✓ No error page indicators found

[STEP 10] Writing file to disk
  ✅ File written: /path/to/logos/504713.svg

[STEP 11] Verifying written file
  ✅ ✓ File size verified: 12345 bytes
  ✅ ✓ File readback successful
  ✅ ✓ File is readable

[STEP 12] Updating database with validated logo
  ✅ Database updated with validated logo

================================================================================
✅ LOGO VALIDATION PASSED
================================================================================
```

### Validation Failure

If any validation check fails:
- Detailed error message explaining what failed
- Automatic cleanup of partial downloads
- Database NOT updated (prevents storing bad logos)
- Full error diagnostics in logs

```
================================================================================
❌ LOGO VALIDATION FAILED
================================================================================
  ❌ Download/validation failed: File too small (0.12 KB) - likely not a valid logo
  🔍 Download error details:
     {
       "error": "File too small...",
       "validationFailed": true
     }
  ℹ️  Cleaned up partial download
```

### What the Validation Guarantees

When validation passes, you can be confident that:

✅ **The file is a real image** (not an error page or HTML)
✅ **The file is the right size** (not a tiny placeholder or huge non-logo)
✅ **The file format is correct** (SVG, PNG, or JPEG verified by magic bytes)
✅ **The file was downloaded completely** (size verified)
✅ **The file was written successfully** (disk write confirmed)
✅ **The file is readable** (permissions verified)
✅ **The app can use the logo** (full path stored in database)

### Common Validation Failures

| Failure | Cause | Solution |
|---------|-------|----------|
| File too small | Error page or placeholder | Improve URL discovery strategy |
| Invalid content type | Wrong file type or error page | Check URL transformation logic |
| Error page detected | Downloaded HTML error page | Verify URL is direct image link |
| File signature mismatch | Corrupted download or wrong format | Retry or check URL |
| Write/readback failure | Disk full or permissions | Check server disk space |
| Permission issue | File permissions incorrect | Check directory permissions |

## Search Strategy

The tool uses an iterative Brandfetch API approach to find logos:

### 1. Domain Variation Generation
- Cleans bank name (removes "National Association", "N.A.", etc.)
- Generates primary domain variations (e.g., "jpmorganchase.com")
- Includes common abbreviations for major banks (e.g., "chase.com", "bofa.com")
- Creates variations like `{cleanedname}.com` and `{cleanedname}bank.com`

### 2. Brandfetch API Search
- Base URL: `https://cdn.brandfetch.io/{domain}/{logoType}.{format}`
- Tries multiple logo types: `logo`, `symbol`, `icon`
- Tries multiple formats: `svg`, `png`
- Authenticated with client ID query parameter
- Returns logos directly from Brandfetch CDN

### 3. Iterative Search Pattern
- Loops through all domain variations
- For each domain, tries all logo type × format combinations
- Stops when first successful match is found
- Logs all attempted URLs for debugging

### Example Search Sequence
For "JPMorgan Chase Bank, National Association":
1. Try `jpmorganchase.com/logo.svg`
2. Try `jpmorganchase.com/logo.png`
3. Try `jpmorgan.com/logo.svg`
4. Try `chase.com/logo.svg` ✓ Found!
5. Stop and validate

## Analyzing Logs for Strategy Improvement

The verbose output is designed to be fed back into Claude for analysis. You can:

1. **Capture full output to a file:**
   ```bash
   node server/scripts/cli/findLogos.js --count 10 > logo_analysis.log 2>&1
   ```

2. **Feed the log to Claude with a prompt like:**
   ```
   Analyze these logo finding attempts and suggest improvements to the search strategy.
   Focus on:
   - Which search approaches worked best
   - Common failure patterns
   - URL transformation issues
   - Missing search strategies
   ```

3. **Review specific sections:**
   - Look for patterns in successful vs failed attempts
   - Check which sources (Wikipedia, official sites) have higher success rates
   - Identify URL transformation issues (thumbnail URLs, etc.)
   - Note confidence levels and their correlation with success

## Troubleshooting

### No Logos Found

Check the logs for:
- **Search attempts**: See `attemptedSearches` field
- **URL issues**: Check if URLs need transformation
- **API errors**: Look for timeout or rate limiting messages

### URL Accessibility Issues

If URLs are found but fail to download:
- Check the `URL test failed` warnings
- Verify the URL format (should end in .svg, .png, .jpg)
- Check for redirect or CORS issues in response headers

### Rate Limiting

If processing many banks:
- The script includes 2-second delays between requests
- Consider processing in smaller batches
- Check Claude API rate limits

## Database Storage

Logos are stored in two places:

1. **BankMetadata collection:**
   ```javascript
   {
     logo: {
       url: "https://...",
       source: "Wikipedia",
       localPath: "/path/to/file",
       lastUpdated: Date
     }
   }
   ```

2. **Local filesystem:**
   - Directory: `server/data/logos/`
   - Filename format: `{idrssd}.{ext}`
   - Example: `504713.svg`

## Integration with Research Workflow

Logo finding is part of Phase 1 in the batch research workflow:

- **Batch Research CLI** runs logo gathering automatically
- **Manual Tool** provides detailed logs for debugging
- **Force flag** allows testing new strategies on known banks

## Examples

### Example 1: Find Logos for Top 10 Banks

```bash
node server/scripts/cli/findLogos.js --count 10 > logos_top10.log 2>&1
```

Review the log to see success/failure patterns.

### Example 2: Re-find Logo with Different Strategy

After analyzing logs and updating the prompt:

```bash
node server/scripts/cli/findLogos.js --idrssd 413208 --force
```

### Example 3: Check Status Before Batch Run

```bash
node server/scripts/cli/findLogos.js --list --count 50
```

Identify banks missing logos, then target them specifically.

### Example 4: Process Banks Missing Logos

```bash
# Get list
node server/scripts/cli/findLogos.js --list --count 100 | grep "❌"

# Then manually run for specific banks
node server/scripts/cli/findLogos.js --idrssd 123456
```

## Future Enhancements

Potential improvements based on log analysis:

- [ ] Add alternative image sources (company press kits, brand pages)
- [ ] Implement logo quality scoring
- [ ] Add fallback to favicon if no logo found
- [ ] Support for multiple logo variants (light/dark mode)
- [ ] Automatic retry with adjusted prompts on failure
- [ ] Integration with image recognition to validate logos
- [ ] Batch processing with smart retry logic

## Support

For issues or questions:
- Check the verbose logs for detailed error information
- Review the `notes` field in Claude's responses
- Examine the `attemptedSearches` to see what was tried
- Test URLs manually to verify accessibility
