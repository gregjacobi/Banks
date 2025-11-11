# Deployment Guide

This guide will help you deploy the Bank Explorer application to Render.

## Prerequisites

1. A GitHub account with this repository
2. A Render account (sign up at https://render.com)
3. A MongoDB Atlas account (free tier available at https://www.mongodb.com/cloud/atlas)
4. An Anthropic API key (get one at https://console.anthropic.com/)

## Step 1: Set Up MongoDB Atlas

1. Go to https://www.mongodb.com/cloud/atlas and sign up/login
2. Create a new cluster (free tier is fine)
3. Click "Connect" and choose "Connect your application"
4. Copy the connection string (it will look like: `mongodb+srv://username:password@cluster.mongodb.net/bankexplorer`)
5. Replace `<password>` with your actual database password
6. Keep this connection string handy for Step 3

## Step 2: Deploy to Render

1. Go to https://render.com and sign up/login
2. Click "New +" and select "Web Service"
3. Connect your GitHub account and select this repository
4. Render will automatically detect the `render.yaml` configuration
5. Click "Apply" to create the service

## Step 3: Configure Environment Variables

After the service is created:

1. Go to your service's "Environment" tab
2. Add the following environment variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection string from Step 1
   - `ANTHROPIC_API_KEY`: Your Anthropic API key
   - `NODE_ENV`: production (should already be set)
   - `PORT`: 10000 (should already be set)

3. Click "Save Changes" - this will trigger a redeploy

## Step 4: Wait for Deployment

- Render will now:
  1. Install Node.js dependencies
  2. Build the React frontend
  3. Start the Express server
  4. Your app will be available at: `https://bank-explorer.onrender.com` (or similar)

- First deployment may take 5-10 minutes
- Subsequent deploys are faster

## Step 5: Verify Deployment

1. Once deployed, visit your app URL
2. Check the health endpoint: `https://your-app.onrender.com/api/health`
3. You should see: `{"status":"OK","timestamp":"...","database":"Connected"}`

## Important Notes

### Free Tier Limitations

- Free services spin down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- Consider upgrading to paid tier ($7/month) for always-on service

### Database Connection

- Make sure to whitelist Render's IP addresses in MongoDB Atlas:
  - Go to Network Access in Atlas
  - Click "Add IP Address"
  - Click "Allow Access from Anywhere" (0.0.0.0/0)
  - Or add Render's specific IPs for better security

### Automatic Deployments

- By default, Render automatically deploys when you push to your main branch
- You can disable this in the service settings if needed

### Custom Domain

- You can add a custom domain in the service settings
- Follow Render's instructions to configure DNS

## Troubleshooting

### Build Fails

- Check the build logs in Render dashboard
- Ensure all dependencies are in package.json
- Verify Node.js version compatibility

### Database Connection Issues

- Verify MONGODB_URI is correct
- Check MongoDB Atlas network access settings
- Ensure database user has proper permissions

### App Not Loading

- Check service logs in Render dashboard
- Verify all environment variables are set
- Check that PORT is set to 10000

## Alternative Deployment Options

If you prefer other platforms:

### Railway
- Similar to Render
- Go to https://railway.app
- Connect GitHub repo
- Add environment variables
- Deploy!

### Vercel (Frontend Only)
- Best for frontend-only deployment
- Backend would need to be deployed separately

### DigitalOcean App Platform
- Similar to Render
- Slightly more expensive but very reliable

### Self-Hosted
- Use Docker or deploy directly to a VPS
- Requires more DevOps knowledge

## Post-Deployment

### Monitor Your App
- Check Render dashboard for logs and metrics
- Set up uptime monitoring (e.g., UptimeRobot)

### Update Environment Variables
- Go to service settings in Render
- Update variables as needed
- Save to trigger redeploy

### Scale Your App
- Upgrade from free tier when needed
- Add more instances for high traffic
- Consider adding a CDN for static assets

## Support

For issues with:
- Render: https://render.com/docs
- MongoDB Atlas: https://docs.atlas.mongodb.com/
- This app: Open an issue on GitHub
