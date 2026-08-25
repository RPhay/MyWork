import { sanitizeSettings, withMonitorRemoved } from '../../src/services/focusMonitorsService.js';

/**
 * sanitizeSettings is what stands between whatever a PUT body contains and
 * what gets written to disk, so it is tested directly rather than through
 * the filesystem-backed get/set pair, mirroring how statusDigest.test.js
 * exercises isDue() in isolation.
 */
describe('focus monitor settings sanitizing', () => {
  test('clamps the count to 1-6', () => {
    expect(sanitizeSettings({ count: 0 }).count).toBe(1);
    expect(sanitizeSettings({ count: 8 }).count).toBe(6);
    expect(sanitizeSettings({ count: 3 }).count).toBe(3);
    expect(sanitizeSettings({}).count).toBe(1);
  });

  test('coerces showNumbers to a boolean', () => {
    expect(sanitizeSettings({ showNumbers: 'yes' }).showNumbers).toBe(true);
    expect(sanitizeSettings({ showNumbers: 0 }).showNumbers).toBe(false);
    expect(sanitizeSettings({}).showNumbers).toBe(false);
  });

  test('always returns exactly 6 monitor entries, however many were given', () => {
    expect(sanitizeSettings({ monitors: [] }).monitors).toHaveLength(6);
    expect(sanitizeSettings({ monitors: [{ label: 'Only one' }] }).monitors).toHaveLength(6);
    expect(sanitizeSettings({ monitors: Array(10).fill({ label: 'Too many' }) }).monitors).toHaveLength(6);
  });

  test('forces layout to one of the two valid values, defaulting to side-by-side', () => {
    const [m] = sanitizeSettings({ monitors: [{ layout: 'stacked' }] }).monitors;
    expect(m.layout).toBe('stacked');

    const [defaulted] = sanitizeSettings({ monitors: [{ layout: 'grid' }] }).monitors;
    expect(defaulted.layout).toBe('side-by-side');

    const [missing] = sanitizeSettings({ monitors: [{}] }).monitors;
    expect(missing.layout).toBe('side-by-side');
  });

  test('clamps a label to 40 characters', () => {
    const long = 'x'.repeat(60);
    const [m] = sanitizeSettings({ monitors: [{ label: long }] }).monitors;
    expect(m.label).toHaveLength(40);
  });

  test('a blank/missing label stays blank', () => {
    const [m] = sanitizeSettings({ monitors: [{}] }).monitors;
    expect(m.label).toBe('');
  });
});

/**
 * withMonitorRemoved is the pure half of the "Remove this monitor" context
 * menu action - the entity reassignment (focusService.shiftMonitorsAfterRemoval)
 * is the impure half and is covered by the focus-bar e2e spec instead, since
 * it needs a real database.
 */
describe('withMonitorRemoved', () => {
  const settings = (count, monitors) => ({
    count,
    showNumbers: false,
    monitors: Array.from({ length: 6 }, (_, i) => monitors[i] || { label: '', layout: 'side-by-side' }),
  });

  test('splices out the removed slot and shifts the rest up', () => {
    const before = settings(3, [
      { label: 'One', layout: 'side-by-side' },
      { label: 'Two', layout: 'stacked' },
      { label: 'Three', layout: 'side-by-side' },
    ]);
    const after = withMonitorRemoved(before, 2);
    expect(after.count).toBe(2);
    expect(after.monitors[0]).toEqual({ label: 'One', layout: 'side-by-side' });
    expect(after.monitors[1]).toEqual({ label: 'Three', layout: 'side-by-side' });
  });

  test('always leaves exactly 6 monitor entries, blank ones padded on the end', () => {
    const before = settings(2, [{ label: 'One', layout: 'side-by-side' }, { label: 'Two', layout: 'side-by-side' }]);
    const after = withMonitorRemoved(before, 1);
    expect(after.monitors).toHaveLength(6);
    expect(after.monitors[0]).toEqual({ label: 'Two', layout: 'side-by-side' });
    expect(after.monitors[5]).toEqual({ label: '', layout: 'side-by-side' });
  });

  test('removing the first monitor still shifts correctly', () => {
    const before = settings(2, [{ label: 'First', layout: 'side-by-side' }, { label: 'Second', layout: 'stacked' }]);
    const after = withMonitorRemoved(before, 1);
    expect(after.count).toBe(1);
    expect(after.monitors[0]).toEqual({ label: 'Second', layout: 'stacked' });
  });
});
