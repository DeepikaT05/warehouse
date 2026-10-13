const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || (err.name === 'ValidationError' ? 400 : err.name === 'CastError' ? 400 : 500);
  if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);

  res.status(status).json({
    success: false,
    message: err.name === 'CastError' ? `Invalid id '${err.value}'.` : (err.message || 'Internal server error')
  });
};

module.exports = { notFound, errorHandler };
