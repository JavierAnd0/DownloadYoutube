const { RATE_LIMIT_WINDOW, RATE_LIMIT_MAX, TRUST_PROXY } = require('../config');

// In-memory sliding window rate limiter — sufficient for single-instance deployment
const hits = new Map(); // ip → [timestamp, ...]

function getClientIp(req) {
  if (TRUST_PROXY) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

module.exports = function rateLimiter(req, res, next) {
  const ip  = getClientIp(req);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  const timestamps = (hits.get(ip) || []).filter(t => t > windowStart);
  timestamps.push(now);
  hits.set(ip, timestamps);

  if (timestamps.length > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil(RATE_LIMIT_WINDOW / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      success: false,
      error:   'Too many requests',
      retryAfter,
    });
  }

  next();
};
