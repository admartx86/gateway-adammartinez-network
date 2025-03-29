require('dotenv').config();
const express = require('express');
const app = express();
const fs = require('fs');
const https = require('https');
const tls = require('tls');
const { createProxyMiddleware } = require('http-proxy-middleware');

const domainMappingEnv = process.env.DOMAIN_MAPPING || '';
const domainMapping = Object.fromEntries(domainMappingEnv.split(',').map(pair => pair.split('=')));

const sslCreds = {};
for (const domain of Object.keys(domainMapping)) {
  sslCreds[domain] = {
    key: fs.readFileSync(`/etc/letsencrypt/live/${domain}/privkey.pem`, 'utf8'),
    cert: fs.readFileSync(`/etc/letsencrypt/live/${domain}/cert.pem`, 'utf8'),
    ca: fs.readFileSync(`/etc/letsencrypt/live/${domain}/chain.pem`, 'utf8')
  };
}

const options = {
  SNICallback: function (domain, cb) {
    if (sslCreds[domain]) {
      cb(null, tls.createSecureContext(sslCreds[domain]));
    } else {
      cb(new Error(`No keys/certificates for domain requested: ${domain}`));
    }
  }
};

const httpsServer = https.createServer(options, app);

app.use((req, res, next) => {
  if (!req.secure) {
    return res.redirect(['https://', req.get('Host'), req.url].join(''));
  }
  next();
});

const proxies = {};
for (let [host, target] of Object.entries(domainMapping)) {
  proxies[host] = createProxyMiddleware({
    target,
    changeOrigin: true
  });
}

app.use((req, res, next) => {
  const target = domainMapping[req.headers.host];
  if (target) {
    return proxies[req.headers.host](req, res, next);
  } else {
    res.status(404).send('Domain not found');
  }
});

app.listen(process.env.HTTP_PORT, () => {
  console.log(`app listening on port ${process.env.HTTP_PORT} (HTTP)`);
});

httpsServer.listen(process.env.HTTPS_PORT, () => {
  console.log(`httpsServer listening on port ${process.env.HTTPS_PORT} (HTTPS)`);
});