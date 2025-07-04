const expressStaticGzip = require('express-static-gzip');

const oneDayInSeconds = 24 * 60 * 60;

const sMaxAge = process.env.STATIC_CACHE_S_MAX_AGE || oneDayInSeconds;
const maxAge = process.env.STATIC_CACHE_MAX_AGE || oneDayInSeconds * 2;

const staticCache = (staticPath) =>
  expressStaticGzip(staticPath, {
    enableBrotli: false, // disable Brotli, only using gzip
    orderPreference: ['gz'],
    setHeaders: (res, _path) => {
      if (process.env.NODE_ENV?.toLowerCase() === 'production') {
        const fileName = require('path').basename(_path);
        
        // Don't cache logo files to allow for easy updates
        if (fileName.includes('logo.')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else {
          res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${sMaxAge}`);
        }
      }
    },
    index: false,
  });

module.exports = staticCache;
