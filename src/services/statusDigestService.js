/**
 * The scheduled status update.
 *
 * `reportExportService.buildEmailDraft` has always written the whole thing and
 * deliberately never sent it - the app holds no mail credentials, and sending
 * on someone's behalf by surprise is not a thing to do. What was missing was
 * everything around it: nothing decided WHEN, and nothing kept the result.
 *
 * So this schedules it and keeps it. Delivery is a `mailto:` from the browser,
 * which hands the draft to the mail client the person already uses - no SMTP
 * configuration, no credentials stored here, and nothing leaves the machine
 * without them pressing send.
 *
 * The schedule and the last digest live in `data/` as JSON rather than in a
 * table: two rows of state do not justify a table that both dialects must then
 * maintain forever (audit finding 07 is about exactly that cost).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import * as reportExportService from './reportExportService.js';
import { getActiveContextId } from './activeContextService.js';
import logger from '../utils/logger.js';

const DIR = path.join(process.cwd(), 'data');
const SCHEDULE_FILE = path.join(DIR, 'status-digest-schedule.json');
const LATEST_FILE = path.join(DIR, 'status-digest-latest.json');

const DEFAULT_SCHEDULE = {
  enabled: false,
  // 0 = Sunday. Friday afternoon is the common shape for a weekly update, but
  // it is only a default.
  dayOfWeek: 5,
  time: '16:00',
  // How far back the digest looks. A weekly digest covering a week is the
  // obvious pairing, and anything else would need explaining in the subject.
  days: 7,
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

export async function getSchedule() {
  return { ...DEFAULT_SCHEDULE, ...(await readJson(SCHEDULE_FILE, {})) };
}

export async function setSchedule(patch) {
  const next = { ...(await getSchedule()), ...(patch || {}) };
  next.enabled = !!next.enabled;
  next.dayOfWeek = Math.min(6, Math.max(0, Number(next.dayOfWeek) || 0));
  next.days = Math.min(90, Math.max(1, Number(next.days) || 7));
  if (!/^\d{2}:\d{2}$/.test(String(next.time))) next.time = DEFAULT_SCHEDULE.time;
  await writeJson(SCHEDULE_FILE, next);
  return next;
}

export async function getLatest() {
  return readJson(LATEST_FILE, null);
}

/** Build the digest for the period ending today and keep it. */
export async function generateDigest(contextId = null) {
  if (!contextId) contextId = await getActiveContextId();
  const schedule = await getSchedule();

  const end = new Date();
  const start = new Date(end.getTime() - (schedule.days - 1) * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);

  const draft = await reportExportService.buildEmailDraft(contextId, {
    startDate: iso(start),
    endDate: iso(end),
  });

  const digest = {
    ...draft,
    generatedAt: new Date().toISOString(),
    periodStart: iso(start),
    periodEnd: iso(end),
  };
  await writeJson(LATEST_FILE, digest);
  return digest;
}

/**
 * Has the scheduled moment passed without a digest for it?
 *
 * Deliberately "has it passed", not "is it exactly now": the check runs on a
 * timer, the machine sleeps, and a digest that silently never happened because
 * nobody was awake at 16:00 on Friday is worse than one that arrives late.
 */
function isDue(schedule, latest, now = new Date()) {
  if (!schedule.enabled) return false;

  const [hh, mm] = String(schedule.time).split(':').map(Number);
  // The most recent occurrence of the scheduled slot, at or before now.
  const slot = new Date(now);
  slot.setHours(hh, mm, 0, 0);
  const daysSince = (slot.getDay() - schedule.dayOfWeek + 7) % 7;
  slot.setDate(slot.getDate() - daysSince);
  if (slot > now) slot.setDate(slot.getDate() - 7);

  if (!latest?.generatedAt) return true;
  return new Date(latest.generatedAt) < slot;
}

export { isDue };

let timer = null;
const CHECK_MS = 5 * 60 * 1000;

/**
 * Node's own timer, not a cron dependency: one check every five minutes is
 * enough for something that happens weekly, and it adds nothing to install.
 */
export function startScheduler() {
  if (timer) return;
  const tick = async () => {
    try {
      const [schedule, latest] = await Promise.all([getSchedule(), getLatest()]);
      if (!isDue(schedule, latest)) return;
      const digest = await generateDigest();
      logger.info(`Status digest generated for ${digest.periodStart} to ${digest.periodEnd}`);
    } catch (error) {
      logger.error('Status digest failed:', error);
    }
  };
  timer = setInterval(tick, CHECK_MS);
  if (timer.unref) timer.unref();   // never hold the process open
  tick();
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
