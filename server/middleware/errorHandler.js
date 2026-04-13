const { NODE_ENV } = require('../config');

module.exports = function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message);
  const status = err.status || 500;
  const message = NODE_ENV === 'production' && status === 500
    ? 'Internal server error'
    : err.message || 'Internal server error';
  res.status(status).json({ success: false, error: message });
};
