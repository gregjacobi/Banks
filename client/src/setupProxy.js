const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5001',
      changeOrigin: true,
      logLevel: 'debug',
      pathRewrite: {
        '^/api': '/api'  // Keep the /api prefix
      }
    })
  );
};
