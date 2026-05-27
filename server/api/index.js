require('dotenv').config();
const app = require('../app');
const { runMigrations } = require('../config/migrate');

let migrationDone = false;
const migrationPromise = runMigrations()
  .then(() => { migrationDone = true; })
  .catch((err) => {
    console.error('[startup] migration failed — proceeding anyway:', err.message);
    migrationDone = true;
  });

module.exports = async (req, res) => {
  if (!migrationDone) await migrationPromise;
  return app(req, res);
};
