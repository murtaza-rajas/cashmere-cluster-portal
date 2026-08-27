// Local dev-only Postgres, no root/apt required. Runs a real Postgres binary
// (via `embedded-postgres`) on localhost so Prisma migrations/seed can be tested
// before a real Norway-hosted dev database exists. NOT used in staging/production —
// those connect to the real hosted Postgres via DATABASE_URL as normal.
import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';

const dataDir = path.join(__dirname, '..', '.dev-postgres-data');
const pgCtlBin = path.join(
  __dirname,
  '..',
  'node_modules',
  '@embedded-postgres',
  'linux-x64',
  'native',
  'bin',
  'pg_ctl',
);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: 5432,
  persistent: true,
});

async function main() {
  const action = process.argv[2] ?? 'start';

  if (action === 'start') {
    // `initialise()` always runs initdb, which fails on a non-empty directory —
    // only run it the first time this data dir is used.
    const alreadyInitialised = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
    if (!alreadyInitialised) {
      await pg.initialise();
    }
    await pg.start();
    try {
      await pg.createDatabase('cashmere_lovers_club');
    } catch {
      // already exists — fine
    }
    console.log('Dev Postgres running on localhost:5432 (db: cashmere_lovers_club)');
    console.log('Leave this process running in a separate terminal; Ctrl+C to stop.');
    // Keep the process alive
    process.stdin.resume();
    process.on('SIGINT', async () => {
      await pg.stop();
      process.exit(0);
    });
  } else if (action === 'stop') {
    // NOTE: pg.stop() only works within the same process that called pg.start().
    // Since `stop` is normally run as a fresh CLI invocation, shell out to pg_ctl
    // directly against the existing data dir instead — this is what actually works.
    execFileSync(pgCtlBin, ['-D', dataDir, 'stop', '-m', 'fast'], { stdio: 'inherit' });
    console.log('Dev Postgres stopped.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
