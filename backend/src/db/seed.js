/**
 * Standalone seed script. Ensures the schema exists and the default
 * administrator account is created, without starting the HTTP server.
 * Run with: npm run seed
 */
require('dotenv').config();
const db = require('../config/db');

(async () => {
  await db.initSchema();
  // eslint-disable-next-line no-console
  console.log('✔ Database schema ensured and default administrator seeded (if not already present).');
  await db.pool.end();
})();
