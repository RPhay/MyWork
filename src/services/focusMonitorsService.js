/**
 * Definitions for the focus bar's monitors: whether each shows its number, and
 * each one's optional label and layout (side-by-side or stacked).
 *
 * How MANY monitors exist is not stored here, or anywhere - it is not a
 * setting. A monitor exists the moment something is dragged onto the bar's
 * empty space and creates it, and stops existing the moment nothing is pinned
 * to it any more; routes/api/focusMonitors.js derives the count on every read
 * from focusService.getFocusItems() (the highest `focus_monitor` in use).
 * This file only holds the LABEL/LAYOUT for whichever monitor numbers you have
 * used at some point - small singleton config that does not justify a table
 * either dialect must then maintain forever, same reasoning as
 * statusDigestService.js.
 *
 * Which items sit on which monitor is a property of the item itself
 * (`focus_monitor`, alongside `focus_slot` - see focusService.js).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getActiveUserId } from './activeUserService.js';

const DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DIR, 'focus-monitors.json');

const LAYOUTS = new Set(['side-by-side', 'stacked']);
const MAX_LABEL_LENGTH = 40;

// There is no product limit on how many monitors you may have - 0 is valid and
// so is "more than fit comfortably". This bound exists only so a nonsense
// `count` (a typo, or an unvalidated client) cannot ask us to build and store
// an arbitrarily long array. Raise it freely; it is not a design statement.
export const MAX_MONITORS = 32;

const DEFAULT_MONITOR = { label: '', layout: 'side-by-side' };

const DEFAULT_SETTINGS = {
  showNumbers: false,
  // Always MAX_MONITORS entries, so a monitor that stops being used (nothing
  // pinned to it right now) does not lose its label or layout - it comes back
  // exactly as it was the moment something is pinned there again.
  monitors: Array.from({ length: MAX_MONITORS }, () => ({ ...DEFAULT_MONITOR })),
};

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await mkdir(DIR, { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2));
}

/**
 * Clamp/coerce a settings object into a valid one. Pure and exported so it
 * can be unit-tested without touching the filesystem, mirroring `isDue()` in
 * statusDigestService.js. Operates on an already-merged object - callers
 * that only have a partial patch should merge over the current settings
 * first (see setMonitorSettings).
 */
export function sanitizeSettings(patch) {
  const showNumbers = !!patch?.showNumbers;

  // Shipped with every read so the browser enforces the SAME bound as the
  // server without a second copy of the number in the frontend.
  const maxMonitors = MAX_MONITORS;

  const given = Array.isArray(patch?.monitors) ? patch.monitors : [];
  const monitors = Array.from({ length: MAX_MONITORS }, (_, i) => {
    const m = given[i] || {};
    return {
      label: String(m.label ?? '').slice(0, MAX_LABEL_LENGTH),
      layout: LAYOUTS.has(m.layout) ? m.layout : DEFAULT_MONITOR.layout,
    };
  });

  return { showNumbers, monitors, maxMonitors };
}

// PER PROFILE, sharing one file.
//
// The focus bar is the most personal thing on the screen - how many zones, what
// they are called - so leaving it global would be the first place one profile
// visibly leaked into another.
//
// Settings live under `byUser[<id>]`. A user who has never changed theirs falls
// back to the values at the TOP level of the file, which is the shape this file
// had before profiles existed. That is deliberate rather than a migration step:
// the existing configuration keeps working for everybody, and only becomes one
// person's the moment they change it. Nothing is rewritten, so nothing is lost
// if profiles are abandoned.
//
// With nobody chosen, the top-level values are read and written directly, which
// is exactly the old behaviour.
function legacyOf(store) {
  return { showNumbers: store.showNumbers, monitors: store.monitors };
}

export async function getMonitorSettings() {
  const store = await readJson(SETTINGS_FILE, {});
  const userId = await getActiveUserId();
  const mine = userId ? store.byUser?.[userId] : null;
  return sanitizeSettings({ ...DEFAULT_SETTINGS, ...(mine ?? legacyOf(store)) });
}

export async function setMonitorSettings(patch) {
  const store = await readJson(SETTINGS_FILE, {});
  const userId = await getActiveUserId();
  const next = sanitizeSettings({ ...(await getMonitorSettings()), ...(patch || {}) });

  if (userId) {
    await writeJson(SETTINGS_FILE, { ...store, byUser: { ...(store.byUser || {}), [userId]: next } });
  } else {
    await writeJson(SETTINGS_FILE, { ...store, ...next });
  }
  return next;
}

/**
 * The settings after removing the monitor at `position` (1-based): its label
 * and layout are spliced out and every later one shifts down to match its new
 * number, so a monitor's config always follows the same renumbering
 * focusService.shiftMonitorsAfterRemoval applies to what is pinned there. A
 * blank entry is pushed back onto the end so the array still holds exactly
 * MAX_MONITORS entries.
 *
 * Pure - the entity reassignment is focusService's job, since that touches
 * entities, not this file's settings. The caller runs that reassignment
 * against the SAME `position` before or after calling this; the two are
 * independent stores that just need to agree in the end.
 */
export function withMonitorRemoved(settings, position) {
  const pos = Math.max(1, Number(position) || 1);
  const monitors = settings.monitors.slice();
  monitors.splice(pos - 1, 1);
  monitors.push({ ...DEFAULT_MONITOR });
  return sanitizeSettings({ ...settings, monitors });
}
