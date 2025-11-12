const axios = require('axios');
require('dotenv').config();

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;

if (!RENDER_API_KEY || !RENDER_SERVICE_ID) {
  console.error('❌ Missing RENDER_API_KEY or RENDER_SERVICE_ID in .env file');
  process.exit(1);
}

const RENDER_API_BASE = 'https://api.render.com/v1';

/**
 * Get service information
 */
async function getServiceInfo() {
  try {
    const response = await axios.get(
      `${RENDER_API_BASE}/services/${RENDER_SERVICE_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${RENDER_API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching service info:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get recent logs
 */
async function getLogs(limit = 100) {
  try {
    const response = await axios.get(
      `${RENDER_API_BASE}/services/${RENDER_SERVICE_ID}/logs`,
      {
        headers: {
          'Authorization': `Bearer ${RENDER_API_KEY}`,
          'Accept': 'application/json'
        },
        params: {
          limit: limit
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching logs:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get deploys for the service
 */
async function getDeploys(limit = 5) {
  try {
    const response = await axios.get(
      `${RENDER_API_BASE}/services/${RENDER_SERVICE_ID}/deploys`,
      {
        headers: {
          'Authorization': `Bearer ${RENDER_API_KEY}`,
          'Accept': 'application/json'
        },
        params: {
          limit: limit
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching deploys:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Main monitoring function
 */
async function monitorLogs() {
  try {
    console.log('🔍 Fetching Render service information...\n');

    // Get service info
    const serviceInfo = await getServiceInfo();
    console.log('📊 Service Info:');
    console.log(`   Name: ${serviceInfo.name}`);
    console.log(`   Type: ${serviceInfo.type}`);
    console.log(`   Region: ${serviceInfo.region}`);
    console.log(`   Status: ${serviceInfo.suspended ? '⏸️  Suspended' : '✅ Active'}`);
    console.log(`   URL: ${serviceInfo.serviceDetails?.url || 'N/A'}`);
    console.log('');

    // Get recent deploys
    console.log('🚀 Recent Deploys:');
    const deploys = await getDeploys(3);
    if (deploys && deploys.length > 0) {
      deploys.forEach((deploy, index) => {
        const status = deploy.status === 'live' ? '✅' :
                      deploy.status === 'build_failed' ? '❌' :
                      deploy.status === 'deactivated' ? '⏸️' : '🔄';
        console.log(`   ${status} ${deploy.commit?.message || 'No message'}`);
        console.log(`      Status: ${deploy.status} | ${formatTimestamp(deploy.createdAt)}`);
        if (index < deploys.length - 1) console.log('');
      });
    } else {
      console.log('   No recent deploys found');
    }
    console.log('');

    // Get logs
    console.log('📋 Recent Logs (last 50 entries):');
    console.log('─'.repeat(80));
    const logs = await getLogs(50);

    if (logs && logs.length > 0) {
      logs.forEach(log => {
        const timestamp = formatTimestamp(log.timestamp);
        const message = log.message.trim();
        console.log(`[${timestamp}] ${message}`);
      });
    } else {
      console.log('   No logs available');
    }
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.status === 401) {
      console.error('   Invalid API key. Please check RENDER_API_KEY in .env');
    } else if (error.response?.status === 404) {
      console.error('   Service not found. Please check RENDER_SERVICE_ID in .env');
    }
  }
}

// Run the monitor
monitorLogs();
