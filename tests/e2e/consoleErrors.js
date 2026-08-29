// Collecting console errors from a page, and judging which of them mean
// anything. Used by the specs whose whole job is "the page loads without
// throwing" - debug, debug-errors, drag-protocol.
//
// Two rules, both earned on 2026-08-28:
//
// 1. `favicon` and `net::ERR_*` are noise about FETCHING things, not about the
//    application. drag-protocol already filtered those.
//
// 2. A network failure INVALIDATES the assertion instead of failing it. The
//    reporting tab pulls Chart.js from a public CDN, so the moment the machine
//    loses connectivity that script never arrives and the page throws
//    `ReferenceError: Chart is not defined` - a genuine console error caused by
//    nothing the app did. That produced two failures in the full suite, both of
//    which passed on re-run once the network was back. Filtering the message
//    itself would be wrong: `Chart is not defined` is a REAL defect if the
//    script was served and simply did not run. So the trigger is the observed
//    network failure, not the downstream symptom.
const OFFLINE = /net::ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_|ADDRESS_UNREACHABLE|TIMED_OUT)/i;

export function watchConsole(page) {
  const errors = [];
  const failures = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('requestfailed', (req) => {
    failures.push(`${req.url()} ${req.failure()?.errorText ?? ''}`);
  });

  return {
    // True when the browser could not reach the network at all. Callers skip
    // rather than fail: with the page's dependencies missing, whatever it
    // logged says nothing about the code under test.
    get offline() {
      return failures.some((f) => OFFLINE.test(f)) || errors.some((e) => OFFLINE.test(e));
    },
    // Errors worth failing over.
    get real() {
      return errors.filter((e) => !/favicon|net::ERR/i.test(e));
    },
    get all() {
      return errors.slice();
    },
    get requestFailures() {
      return failures.slice();
    },
  };
}
