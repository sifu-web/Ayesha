/* Centralized error handler — never leaks stack traces to the client in production. */
function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Resource not found.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const isDev = process.env.NODE_ENV !== 'production';

  if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File is too large.' });
  }

  console.error(`[ERROR] ${req.method} ${req.originalUrl} —`, err.message);

  res.status(status).json({
    success: false,
    message: status === 500 ? 'Something went wrong on our end.' : err.message,
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
