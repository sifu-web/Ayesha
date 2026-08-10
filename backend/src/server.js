require('dotenv').config();
require('express-async-errors'); // forwards rejected promises in async route handlers to errorHandler

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const db = require('./config/db');
const csrfProtection = require('./middleware/csrf');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const mediaRoutes = require('./routes/media.routes');
const statsRoutes = require('./routes/stats.routes');
const auditRoutes = require('./routes/audit.routes');
const keysRoutes = require('./routes/keys.routes');

const app = express();

// Trust the first proxy hop (relevant when deployed behind Render/Railway/Nginx).
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api', apiLimiter);
app.use('/api', csrfProtection);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Ayesha...💗 API is running.', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/keys', keysRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// The database schema must exist (and the default admin be seeded) before
// the server starts accepting requests.
db.initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log('');
      console.log('  ╭──────────────────────────────────────────╮');
      console.log('  │        Ayesha...💗  — API Server          │');
      console.log(`  │  Running on http://localhost:${PORT}          │`);
      console.log(`  │  Environment: ${(process.env.NODE_ENV || 'development').padEnd(28)}│`);
      console.log('  ╰──────────────────────────────────────────╯');
      console.log('');
    });
  })
  .catch((err) => {
    console.error('Failed to initialize the database:', err);
    process.exit(1);
  });

module.exports = app;
