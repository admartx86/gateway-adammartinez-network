require('dotenv').config();
const express = require('express');
const app = express();
const fs = require('fs');
const https = require('https');
const tls = require('tls');
const { createProxyMiddleware } = require('http-proxy-middleware');

const domainMappingEnv = process.env.DOMAIN_MAPPING || '';
const domainMapping = Object.fromEntries(domainMappingEnv.split(',').map(pair => pair.split('=')));

// Load SSL credentials into an object indexed by domain name
const sslCreds = {};
for (const domain of Object.keys(domainMapping)) {
  sslCreds[domain] = {
    key: fs.readFileSync(`../certification/${domain}/privkey.pem`, 'utf8'),
    cert: fs.readFileSync(`../certification/${domain}/cert.pem`, 'utf8'),
    ca: fs.readFileSync(`../certification/${domain}/chain.pem`, 'utf8')
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



// require('dotenv').config();

// const express = require('express');
// const app = express();

// const fs = require('fs');

// const privateKeyPath = process.env.PRIVATE_KEY_PATH;
// const certificatePath = process.env.CERTIFICATE_PATH;
// const caPath = process.env.CA_PATH;

// const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
// const certificate = fs.readFileSync(certificatePath, 'utf8');
// const ca = fs.readFileSync(caPath, 'utf8');

// const credentials = { key: privateKey, cert: certificate, ca: ca };
// const https = require('https');
// const httpsServer = https.createServer(credentials, app);

// app.use((req, res, next) => {
//   if (!req.secure) {
//     return res.redirect(['https://', req.get('Host'), req.url].join(''));
//   }
//   next();
// });

// const { createProxyMiddleware } = require('http-proxy-middleware');
// const domainMappingEnv = process.env.DOMAIN_MAPPING || '';
// const domainMapping = Object.fromEntries(domainMappingEnv.split(',').map(pair => pair.split('=')));
// const proxies = {};
// for (let [host, target] of Object.entries(domainMapping)) {
//   proxies[host] = createProxyMiddleware({
//     target,
//     changeOrigin: true
//   });
// }
// app.use((req, res, next) => {
//   const target = domainMapping[req.headers.host];
//   if (target) {
//     return proxies[req.headers.host](req, res, next);
//   } else {
//     res.status(404).send('Domain not found');
//   }
// });

// app.listen(process.env.HTTP_PORT, () => {
//   console.log(`app listening on port ${process.env.HTTP_PORT} (HTTP)`);
// });

// httpsServer.listen(process.env.HTTPS_PORT, () => {
//   console.log(`httpsServer listening on port ${process.env.HTTPS_PORT} (HTTPS)`);
// });