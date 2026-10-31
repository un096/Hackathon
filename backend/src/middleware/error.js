const { ApiError } = require('../lib/errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, message: err.message, details: err.details });
  }
  if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'A record with these values already exists' });
  if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Record not found' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Malformed JSON body' });
  if (err.name === 'MulterError') return res.status(400).json({ success: false, message: err.message });
  console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({ success: false, message: 'Internal server error' });
}
module.exports = errorHandler;
