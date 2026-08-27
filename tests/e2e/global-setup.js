// Make sure a profile is chosen before any spec runs.
//
// MyWork asks who is using it (src/services/activeUserService.js). With nobody
// chosen the app raises a picker over the page with a STATIC backdrop, on
// purpose - at that point it is already showing somebody's data, and letting
// that pass unnoticed is the one thing profiles exist to prevent.
//
// For the suite that modal is a wall. It sits above everything, so the very
// first click of the very first spec misses, and all 366 fail with timeouts
// that say nothing about what is wrong. It would not happen on a machine that
// has used the app - `data/active-user.json` is already there - which is worse
// than failing everywhere: it fails only on a clean checkout or a fresh CI
// container, which is exactly where the message is least useful.
//
// So this does once what a person does once: pick somebody.
//
// It writes the file directly rather than driving the UI. The store is a plain
// JSON file by design, no browser is running yet at global-setup time, and a
// setup step that needs the app to already work cannot be the thing that makes
// the app work.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const STORE = path.join(ROOT, 'data/active-user.json');

export default async function globalSetup() {
  // Imported lazily: loading the pool at module scope would connect before
  // Playwright has decided whether it is even running.
  const db = await import('../../src/database/homePool.js');
  const users = await db.query('SELECT id, name FROM users ORDER BY id ASC');

  // Already chosen: leave it alone. Overwriting would switch the profile out
  // from under whoever is using this machine, and on a developer's box that
  // means their next manual session opens as somebody else.
  //
  // But the stored id has to be CHECKED against the database, not just read.
  // A previous run whose teardown was cut short can leave this file naming a
  // test profile that the teardown then deleted, and a dangling id is exactly
  // the same to the app as no id at all - it raises the picker, which blocks
  // every spec. Trusting the file made this setup step assert the one thing it
  // exists to guarantee, and get it wrong.
  try {
    const existing = JSON.parse(fs.readFileSync(STORE, 'utf8'));
    if (existing?.activeUserId && users.some((u) => u.id === existing.activeUserId)) {
      console.log(`[global-setup] profile already chosen (user ${existing.activeUserId})`);
      return;
    }
    if (existing?.activeUserId) {
      console.warn(`[global-setup] stored profile ${existing.activeUserId} no longer exists - choosing again`);
    }
  } catch {
    // No file, or unreadable - fall through and choose one.
  }

  if (users.length === 0) {
    // A database with no users at all. Say so rather than inventing one - a
    // user invented here would own no contexts, so every spec would then fail
    // on "this user has no contexts yet", one puzzle traded for another.
    console.warn('[global-setup] no users exist - the profile picker will block the suite. '
      + 'Create a user, or run the app once and choose one.');
    return;
  }

  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify({ activeUserId: users[0].id }, null, 2));
  console.log(`[global-setup] chose profile "${users[0].name}" (id ${users[0].id})`);
}
