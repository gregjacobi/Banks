const https = require('https');
require('dotenv').config();

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function checkStatus() {
  try {
    console.log('🔍 Checking Render Service Status\n');
    console.log('═'.repeat(80));

    // Get service info
    const service = await makeRequest(`/v1/services/${RENDER_SERVICE_ID}`);

    console.log('\n📊 SERVICE INFORMATION');
    console.log('─'.repeat(80));
    console.log(`Name:           ${service.name}`);
    console.log(`Status:         ${service.suspended === 'not_suspended' ? '✅ Active' : '⏸️  Suspended'}`);
    console.log(`Type:           ${service.type}`);
    console.log(`Region:         ${service.region}`);
    console.log(`URL:            ${service.serviceDetails?.url}`);
    console.log(`Auto Deploy:    ${service.autoDeploy}`);
    console.log(`Branch:         ${service.branch}`);

    // Get events
    console.log('\n📋 RECENT EVENTS');
    console.log('─'.repeat(80));
    const eventsData = await makeRequest(`/v1/services/${RENDER_SERVICE_ID}/events?limit=10`);

    if (eventsData && eventsData.length > 0) {
      eventsData.forEach((item) => {
        const event = item.event;
        const timestamp = new Date(event.timestamp).toLocaleString();
        let icon = '•';
        let message = event.type;

        switch(event.type) {
          case 'server_unhealthy':
            icon = '❌';
            message = `Server Unhealthy (Instance: ${event.details?.instanceID})`;
            break;
          case 'deploy_ended':
            icon = event.details?.deployStatus === 'succeeded' ? '✅' : '❌';
            message = `Deploy ${event.details?.deployStatus}`;
            break;
          case 'build_ended':
            icon = event.details?.buildStatus === 'succeeded' ? '✅' : '❌';
            message = `Build ${event.details?.buildStatus}`;
            break;
          case 'deploy_started':
            icon = '🚀';
            message = 'Deploy Started';
            break;
          case 'build_started':
            icon = '🔨';
            message = 'Build Started';
            break;
        }

        console.log(`${icon} [${timestamp}] ${message}`);
      });
    }

    // Get recent deploys
    console.log('\n🚀 RECENT DEPLOYS');
    console.log('─'.repeat(80));
    const deploys = await makeRequest(`/v1/services/${RENDER_SERVICE_ID}/deploys?limit=3`);

    if (deploys && deploys.length > 0) {
      deploys.forEach((item) => {
        const deploy = item.deploy;
        const status = deploy.status === 'live' ? '✅ Live' :
                      deploy.status === 'build_failed' ? '❌ Failed' :
                      deploy.status === 'deactivated' ? '⏸️  Deactivated' : '🔄 ' + deploy.status;

        console.log(`\n${status}`);
        console.log(`  Commit: ${deploy.commit?.message?.split('\n')[0] || 'No message'}`);
        console.log(`  ID: ${deploy.id}`);
        console.log(`  Created: ${new Date(deploy.createdAt).toLocaleString()}`);
        if (deploy.finishedAt) {
          const duration = Math.round((new Date(deploy.finishedAt) - new Date(deploy.startedAt)) / 1000);
          console.log(`  Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
        }
      });
    }

    console.log('\n═'.repeat(80));

    // Check if server is unhealthy
    const hasUnhealthyEvent = eventsData && eventsData.some(item =>
      item.event.type === 'server_unhealthy'
    );

    if (hasUnhealthyEvent) {
      console.log('\n⚠️  WARNING: Server is reporting as UNHEALTHY');
      console.log('   This usually means:');
      console.log('   • Application is crashing on startup');
      console.log('   • Database connection failed');
      console.log('   • Missing environment variables');
      console.log('   • Port binding issues\n');
      console.log('   To fix: Check the Render dashboard logs at:');
      console.log(`   https://dashboard.render.com/web/${RENDER_SERVICE_ID}\n`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

checkStatus();
