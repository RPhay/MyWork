/**
 * Double-click by DISPATCHING the event, not by driving the pointer.
 *
 * Use this instead of Playwright's `locator.dblclick()` anywhere the app reacts
 * to a `dblclick` listener - opening an editor, a focus chip jumping to its
 * record, a type tab taking the screen.
 *
 * Why: `dblclick()` sends two clicks and leaves it to the BROWSER to decide
 * whether they were close enough together to also be a double-click. When they
 * fall outside that threshold - which a loaded machine can cause, and a full
 * guard run is exactly that - no `dblclick` event fires at all. The listener
 * never runs, nothing opens, and the assertion that follows reports an app bug
 * that is not there. It fails a few runs in a row, then passes twenty, and
 * cannot be reproduced afterwards.
 *
 * That is not a theory. Splitting a `dblclick()` into two `click()` calls
 * reproduces it exactly: the editor never switches, and Save stays enabled
 * showing the previous item's edited title - byte for byte the failure seen in
 * the guard set on 2026-08-21.
 *
 * The handler receives the same event either way, so nothing about what is
 * being tested changes. This is the same reasoning CLAUDE_TESTING.md already
 * records for drag ("A pointer drag cannot always reach its target. Drive
 * nesting with drag EVENTS; the drop handler receives the same thing either
 * way").
 *
 * What it deliberately does NOT do is fire the two clicks. A real double-click
 * fires them, and on a row they apply selection; where a test depends on that,
 * click first and then call this. On a focus chip or a type tab the two clicks
 * are pure noise the handler undoes anyway (a chip's click starts and stops the
 * clock), so leaving them out is closer to the gesture's intent, not further
 * from it.
 */
export const dblclick = (locator) => locator.dispatchEvent('dblclick');
