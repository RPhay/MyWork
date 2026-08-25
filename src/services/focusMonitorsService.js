/**
 * Definitions for the focus bar's monitors: how many zones (1-6), whether
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

const DEFAULT_MONITOR = { label: '', layout: 'side-by-side' };

const DEFAULT_SETTINGS = {
  count: 1,
  showNumbers: false,
  // Always 6 entries regardless of `count`, so turning the count down and
  // back up never loses a label or layout already set for a hidden monitor.
  monitors: Array.from({ length: 6 }, () => ({ ...DEFAULT_MONITOR })),
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
  const count = Math.min(6, Math.max(1, Number(patch?.count) || 1));
  const showNumbers = !!patch?.showNumbers;

  const given = Array.isArray(patch?.monitors) ? patch.monitors : [];
  const monitors = Array.from({ length: 6 }, (_, i) => {
    const m = given[i] || {};
    return {
      label: String(m.label ?? '').slice(0, MAX_LABEL_LENGTH),
      layout: LAYOUTS.has(m.layout) ? m.layout : DEFAULT_MONITOR.layout,
    };
  });

  return { count, showNumbers, monitors };
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
 * holds exactly 6 entries, and the count drops by one.
 *
 * Pure - reassigning whatever was pinned to the removed monitor (or to a
 * later one, which is about to be renumbered) is focusService's job, since
 * that touches entities, not this file's settings. The caller runs that
 * reassignment against the SAME `position` before or after calling this; the
 * two are independent stores that just need to agree in the end.
 */
export function withMonitorRemoved(settings, position) {
  const pos = Math.max(1, Number(position) || 1);
  const monitors = settings.monitors.slice();
  monitors.splice(pos - 1, 1);
  monitors.push({ ...DEFAULT_MONITOR });
  return sanitizeSettings({ ...settings, count: settings.count - 1, monitors });
}
