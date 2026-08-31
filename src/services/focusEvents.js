// The focus bar's change bell. Every view of the bar - the navbar, each of
// the desktop wrapper's floating windows - is its own page, and the pages
// keep in sync by re-reading. Polling alone cannot do that promptly: the
// browser throttles a hidden tab's timers to once a minute, so the navbar
// of a tab you are not looking at would lag that far behind a pop-out.
// Network events are NOT throttled - so mutations ring this bell, an SSE
// stream (GET /api/focus/events) carries it to every open view, and each
// re-reads immediately. The 2-second poll in focus-bar.js stays as the
// fallback for anything the bell misses.
import { EventEmitter } from "events";

export const focusEvents = new EventEmitter();
// One listener per open view, and views can be many (tabs, pop-outs).
focusEvents.setMaxListeners(200);

export function broadcastFocusChange() {
  focusEvents.emit("change");
}
