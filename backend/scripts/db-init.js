/**
 * Prepares the database for `prisma migrate deploy`:
 *  - creates the database named in DATABASE_URL if it does not exist
 *  - if it contains tables but no Prisma migration history (e.g. an earlier prototype),
 *    asks before dropping the public schema so the migration can be applied cleanly.
 * Exit code 0 = ready, 1 = error, 2 = user declined.
 */
require('dotenv').config();
const { Client } = require('pg');
const readline = require('readline');

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is missing in backend/.env'); process.exit(1); }

const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a.trim().toLowerCase()); }); });

(async () => {
  const u = new URL(url);
  const dbName = decodeURIComponent(u.pathname.slice(1)) || 'postgres';
  const adminUrl = new URL(url); adminUrl.pathname = '/postgres';
  try {
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!exists.rowCount) {
      await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`Created database ${dbName}`);
    }
    await admin.end();
  } catch (e) {
    console.error(`\nCannot connect to PostgreSQL with DATABASE_URL (${u.username}@${u.host}).\n  ${e.message}\nCheck that PostgreSQL is running and the user/password in backend\\.env are correct.`);
    process.exit(1);
  }

  const db = new Client({ connectionString: url });
  await db.connect();
  const { rows } = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  const names = rows.map((r) => r.table_name);
  const hasHistory = names.includes('_prisma_migrations');
  let applied = false;
  if (hasHistory) {
    const m = await db.query("SELECT 1 FROM _prisma_migrations WHERE migration_name = '20261031000000_init' AND finished_at IS NOT NULL");
    applied = m.rowCount > 0;
  }
  if (names.length && !applied) {
    console.log(`\nDatabase "${dbName}" already contains ${names.length} table(s) from an earlier version (${names.slice(0, 6).join(', ')}${names.length > 6 ? ', ...' : ''}).`);
    const a = process.env.TB_RESET_DB === 'yes' ? 'y' : await ask('Drop them and create the TalentBridge schema? All data in this database will be deleted. [y/N] ');
    if (a !== 'y' && a !== 'yes') { console.log('Not changed. Use an empty database (edit DATABASE_URL) or answer y.'); await db.end(); process.exit(2); }
    await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('Old tables removed.');
  }
  await db.end();
  console.log('Database ready.');
})().catch((e) => { console.error(e.message); process.exit(1); });
