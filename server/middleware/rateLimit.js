const buckets = new Map();

function keyFromReq(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function createRateLimiter(max, windowMs) {
  return (req, res, next) => {
    const now = Date.now();
    const key = keyFromReq(req) + ':' + windowMs + ':' + max;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    next();
  };
}

module.exports = { createRateLimiter };


