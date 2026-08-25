/**
 * Definitions for the focus bar's monitors: how many zones (0 upwards), whether
 * each shows its number, and each one's optional label and layout
 * (side-by-side or stacked).
 *
 * Which items sit on which monitor is a property of the item itself
 * (`focus_monitor`, alongside `focus_slot` - see focusService.js). This file
 * only holds the shape of the zones - small singleton config that does not
 * justify a table either dialect must then maintain forever, same reasoning
 * as statusDigestService.js.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

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
  // The count may be 0 (the bar disappears entirely); 1 is only the default
  // for a config that has never been saved.
  count: 1,
  showNumbers: false,
  // Always MAX_MONITORS entries regardless of `count`, so turning the count
  // down and back up never loses a label or layout already set for a hidden
  // monitor.
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
  // 0 is a real setting, not "unset": with no monitors the focus bar shows
  // nothing at all. So the floor is 0, and the coercion cannot use `|| 1` -
  // Number(0) is falsy, so `|| 1` silently turned "no monitors" back into one.
  // `null`, `undefined` and '' are UNSET and fall back to the default; only a
  // real number counts. Number() alone will not do: Number(null) and Number('')
  // are both 0, which would read a missing setting as a deliberate "no
  // monitors" and hide the bar on a config that never mentioned it.
  const givenCount = patch?.count;
  const raw = (givenCount === null || givenCount === undefined || givenCount === '')
    ? NaN
    : Number(givenCount);
  const count = Number.isFinite(raw)
    ? Math.min(MAX_MONITORS, Math.max(0, Math.trunc(raw)))
    : DEFAULT_SETTINGS.count;
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

  return { count, showNumbers, monitors, maxMonitors };
}

export async function getMonitorSettings() {
  return sanitizeSettings({ ...DEFAULT_SETTINGS, ...(await readJson(SETTINGS_FILE, {})) });
}

export async function setMonitorSettings(patch) {
  const next = sanitizeSettings({ ...(await getMonitorSettings()), ...(patch || {}) });
  await writeJson(SETTINGS_FILE, next);
  return next;
}

/**
 * The settings after removing the monitor at `position` (1-based): its slot
 * is spliced out, a blank one is pushed back onto the end so the array still
 * holds exactly MAX_MONITORS entries, and the count drops by one.
 *
 * Pure - reassigning whatever was pinned to the removed monitor (or to a
 * later one, which is about to be renumbered) is focusService's job, since
 * that touches entities, not this file's settings. The caller runs that
 * reassignment against the SAME `position` before or after calling this; the
 * two are independent stores that just need to agree in the end.
 */
export function withMonitorRemoved(settings, position) {
  const pos = Math.max(1, Number(position) || 1);
  if (settings.count <= 0) return sanitizeSettings(settings);   // nothing to remove
  const monitors = settings.monitors.slice();
  monitors.splice(pos - 1, 1);
  monitors.push({ ...DEFAULT_MONITOR });
  return sanitizeSettings({ ...settings, count: settings.count - 1, monitors });
}
