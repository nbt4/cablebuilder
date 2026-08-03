function sanitizeWebsite(url) {
  const trimmed = (url || '').trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}

module.exports = { sanitizeWebsite };
