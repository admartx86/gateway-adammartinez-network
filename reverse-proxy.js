require('dotenv').config();

const fs = require('fs');
const https = require('https');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const privateKeyPath = process.env.PRIVATE_KEY_PATH;
const certificatePath = process.env.CERTIFICATE_PATH;
const caPath = process.env.CA_PATH;
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const certificate = fs.readFileSync(certificatePath, 'utf8');
const ca = fs.readFileSync(caPath, 'utf8');

const credentials = { key: privateKey, cert: certificate, ca: ca };

const app = express();
const domainMapping = {
  'summitstyles.dev': 'http://localhost:3001'
};

// Create proxies first
const proxies = {};
for (let [host, target] of Object.entries(domainMapping)) {
  proxies[host] = createProxyMiddleware({
    target,
    changeOrigin: true
  });
}

// Redirect from http port 80 to https
app.use((req, res, next) => {
  if (!req.secure) {
    return res.redirect(['https://', req.get('Host'), req.url].join(''));
  }
  next();
});

// Use them inside middleware
app.use((req, res, next) => {
  const target = domainMapping[req.headers.host];
  if (target) {
    return proxies[req.headers.host](req, res, next);
  } else {
    res.status(404).send('Domain not found');
  }
});

app.listen(80, () => {
  console.log('Redirecting HTTP traffic to HTTPS on http://localhost:80/');
});

const httpsServer = https.createServer(credentials, app);

httpsServer.listen(443, () => {
  console.log('HTTPS Server running on port 443');
});