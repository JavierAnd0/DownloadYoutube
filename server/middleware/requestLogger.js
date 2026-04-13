const { randomUUID } = require('crypto');

module.exports = function requestLogger(req, res, next) {
  req.id = randomUUID();
  const start = Date.now();

  res.on('finish', () => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      reqId:     req.id,
      method:    req.method,
      path:      req.path,
      status:    res.statusCode,
      ms:        Date.now() - start,
    }));
  });

  next();
};
