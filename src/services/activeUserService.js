// Who is using MyWork right now.
//
// This is a PROFILE PICKER, not authentication. Anyone can become anyone; there
// is no password and there is deliberately no attempt to look like there is
// one. It decides whose work you are looking at, not who is allowed to look.
// See CLAUDE.md's "There is no authentication" - this does not change that
// paragraph, and putting the app on a network still needs a real auth layer
// first.
//
// SERVER-WIDE, ON PURPOSE, and that is the whole reason this design is cheap.
//
// The app holds ONE database connection and swaps it when the active context
// changes (connectionPool's module-level `pool`, reconfigured by
// activeContextService). If "who is signed in" were per-session, two browsers
// could be two different people wanting two different databases at the same
// instant, and that single pool would be wrong for one of them - which is not a
// risk of a leak but a certainty. Keeping the chosen user in one server-wide
// file makes that situation impossible to reach, so the existing pool stays
// correct and no pool-per-context machinery is needed.
//
// The cost of that choice, stated plainly so it is not discovered later: two
// tabs cannot be two users. Switching switches the whole app. That matches how
// the active CONTEXT has always behaved - see the store next door, which this
// one deliberately mirrors.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ValidationError, NotFoundError } from '../config/errors.js';
import { getUserById } from './userService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, '../../data/active-user.json');

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { activeUserId: null };
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    // A corrupt file means "nobody chosen", not a crash on every request. The
    // picker handles that state already.
    return { activeUserId: null };
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

/**
 * The chosen user's id, or null if nobody has been chosen yet.
 *
 * Returns null rather than guessing when the stored id names a user that has
 * since been deleted: picking someone arbitrarily would silently show one
 * person another person's work, which is the single thing this feature exists
 * to prevent.
 */
export async function getActiveUserId() {
  const { activeUserId } = readStore();
  if (!activeUserId) return null;

  const user = await getUserById(activeUserId).catch(() => null);
  return user ? user.id : null;
}

/** The chosen user's row, or null. */
export async function getActiveUser() {
  const id = await getActiveUserId();
  if (!id) return null;
  return getUserById(id);
}

/**
 * Choose a user. Validates that they exist, and stores nothing else - switching
 * to their context is the caller's job (see routes/api/activeUser.js), which
 * keeps this module from having to import activeContextService and forming a
 * cycle with it.
 */
export async function setActiveUserId(id) {
  const numeric = Number(id);
  if (!numeric) throw new ValidationError('A user id is required');

  const user = await getUserById(numeric);
  if (!user) throw new NotFoundError('User not found');

  writeStore({ activeUserId: user.id });
  return user;
}

/** Back to "nobody chosen", which sends the app to the picker. */
export function clearActiveUser() {
  writeStore({ activeUserId: null });
}
