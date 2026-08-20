import { isDue } from '../../src/services/statusDigestService.js';

/**
 * The scheduler asks "has the slot passed without a digest for it", not "is it
 * exactly now". The machine sleeps, the app is not always running, and a digest
 * that silently never happened because nobody was awake at 16:00 on Friday is
 * worse than one that arrives late.
 */
describe('status digest scheduling', () => {
  const schedule = { enabled: true, dayOfWeek: 5, time: '16:00', days: 7 };  // Friday 16:00

  // 2026-08-21 is a Friday.
  const friday = (h, m = 0) => new Date(2026, 7, 21, h, m, 0);
  const saturday = (h, m = 0) => new Date(2026, 7, 22, h, m, 0);

  test('does nothing while it is switched off', () => {
    expect(isDue({ ...schedule, enabled: false }, null, friday(17))).toBe(false);
  });

  test('is due once the slot has passed and nothing has been written', () => {
    expect(isDue(schedule, null, friday(16, 1))).toBe(true);
  });

  test('is not due before the slot, when the last one covered the previous week', () => {
    const lastWeek = { generatedAt: new Date(2026, 7, 14, 16, 5).toISOString() };
    expect(isDue(schedule, lastWeek, friday(15, 59))).toBe(false);
  });

  test('is due again the following week', () => {
    const lastWeek = { generatedAt: new Date(2026, 7, 14, 16, 5).toISOString() };
    expect(isDue(schedule, lastWeek, friday(16, 30))).toBe(true);
  });

  test('is not due twice for the same slot', () => {
    const justWritten = { generatedAt: friday(16, 2).toISOString() };
    expect(isDue(schedule, justWritten, friday(18))).toBe(false);
  });

  // The point of the whole design: a machine that was asleep at the slot still
  // gets its digest when it wakes up.
  test('catches up on a slot that was missed entirely', () => {
    const twoWeeksAgo = { generatedAt: new Date(2026, 7, 7, 16, 0).toISOString() };
    // A day late still counts.
    expect(isDue(schedule, twoWeeksAgo, saturday(9))).toBe(true);
  });
});
