require('dotenv').config();

const fs = require('fs');
const https = require('https');

const privateKeyPath = process.env.PRIVATE_KEY_PATH;
const certificatePath = process.env.CERTIFICATE_PATH;
const caPath = process.env.CA_PATH;

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const certificate = fs.readFileSync(certificatePath, 'utf8');
const ca = fs.readFileSync(caPath, 'utf8');

const credentials = { key: privateKey, cert: certificate, ca: ca };

const express = require('express');
const app = express();

const { createProxyMiddleware } = require('http-proxy-middleware');
const domainMappingEnv = process.env.DOMAIN_MAPPING || '';
const domainMapping = Object.fromEntries(domainMappingEnv.split(',').map(pair => pair.split('=')));
const proxies = {};
for (let [host, target] of Object.entries(domainMapping)) {
  proxies[host] = createProxyMiddleware({
    target,
    changeOrigin: true
  });
}

app.use((req, res, next) => {
  if (!req.secure) {
    return res.redirect(['https://', req.get('Host'), req.url].join(''));
  }
  next();
});

app.use((req, res, next) => {
  const target = domainMapping[req.headers.host];
  if (target) {
    return proxies[req.headers.host](req, res, next);
  } else {
    res.status(404).send('Domain not found');
  }
});

app.listen(process.env.HTTP_PORT, () => {
  console.log(`Redirecting HTTP traffic from PORT ${process.env.HTTP_PORT} to PORT ${process.env.HTTPS_PORT}.`);
});

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(process.env.HTTPS_PORT, () => {
  console.log(`Running HTTPS server on PORT ${process.env.HTTPS_PORT}.`);
});