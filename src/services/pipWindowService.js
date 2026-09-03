// Launches the desktop wrapper (desktop/ - a Tauri app) that floats the
// focus monitors in frameless always-on-top windows. It lives here, on the
// server, because a web page cannot start a local application - but this
// server runs on the same machine as the browser, so spawning the binary IS
// starting it for the user. One instance shows all monitors; an instance
// given a monitor number shows just that one, so several can float at once.
import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ValidationError } from "../config/errors.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

// Release first when both exist - but dev machines will only have debug,
// which `npm run dev` inside desktop/ produces.
const BINARY_CANDIDATES = [
  path.join(repoRoot, "desktop", "src-tauri", "target", "release", "mywork-monitors"),
  path.join(repoRoot, "desktop", "src-tauri", "target", "debug", "mywork-monitors"),
];

// One window per key ('all', or a monitor number): launching again while the
// first is still alive reports that instead of stacking identical windows.
const running = new Map();

export function launchPipWindow(monitor, x = null, y = null) {
  if (!Number.isInteger(monitor) || monitor < 1) {
    throw new ValidationError("monitor must be a positive integer");
  }
  if ((x != null && !Number.isFinite(x)) || (y != null && !Number.isFinite(y))) {
    throw new ValidationError("x and y must be numbers");
  }

  const binary = BINARY_CANDIDATES.find(existsSync);
  if (!binary) {
    throw new ValidationError(
      "The desktop wrapper is not built on this machine - from the repo root, run `npm run desktop:install && npm run desktop:dev` once (requires Rust/Tauri's build tools)",
    );
  }

  const key = String(monitor);
  const existing = running.get(key);
  if (existing && existing.exitCode === null) {
    return { alreadyOpen: true, monitor };
  }

  // CLI shape the wrapper parses (main.rs): <monitor> [x y] - the screen
  // position of the navbar monitor being popped, so the window appears right
  // on top of it, on whichever screen the browser is.
  const args = [String(monitor)];
  if (x != null && y != null) args.push(String(Math.round(x)), String(Math.round(y)));
  const child = spawn(binary, args, { detached: true, stdio: "ignore" });
  child.unref();
  running.set(key, child);
  return { launched: true, monitor };
}

// Launches the SAME wrapper binary in a different mode: one frameless
// always-on-top window showing a single entity's single field, editable, in
// its own OS window - what a sticky note needs and a browser tab, by
// definition, cannot be (see main.rs's `sticky` CLI branch). Keyed by
// type+id+field, not a monitor number, so the SAME note reuses its window
// instead of stacking duplicates, same reasoning as launchPipWindow's guard.
const SLUG_RE = /^[a-z0-9_]+$/i;

export function launchStickyWindow(entityId, typeSlug, fieldKey, x = null, y = null) {
  if (!Number.isInteger(entityId) || entityId < 1) {
    throw new ValidationError("id must be a positive integer");
  }
  // Both end up as part of a URL the desktop wrapper's Rust side builds
  // (http://localhost:3000/sticky?...) - restricted to what a real slug/key
  // ever looks like so that URL can never come out malformed.
  if (!SLUG_RE.test(typeSlug || "")) {
    throw new ValidationError("type must look like a type slug");
  }
  if (!SLUG_RE.test(fieldKey || "")) {
    throw new ValidationError("field must look like a field key");
  }
  if ((x != null && !Number.isFinite(x)) || (y != null && !Number.isFinite(y))) {
    throw new ValidationError("x and y must be numbers");
  }

  const binary = BINARY_CANDIDATES.find(existsSync);
  if (!binary) {
    throw new ValidationError(
      "The desktop wrapper is not built on this machine - from the repo root, run `npm run desktop:install && npm run desktop:dev` once (requires Rust/Tauri's build tools)",
    );
  }

  const key = `sticky:${typeSlug}:${entityId}:${fieldKey}`;
  const existing = running.get(key);
  if (existing && existing.exitCode === null) {
    return { alreadyOpen: true };
  }

  // CLI shape main.rs parses for this mode: sticky <id> <type> <field> [x y]
  const args = ["sticky", String(entityId), typeSlug, fieldKey];
  if (x != null && y != null) args.push(String(Math.round(x)), String(Math.round(y)));
  const child = spawn(binary, args, { detached: true, stdio: "ignore" });
  child.unref();
  running.set(key, child);
  return { launched: true };
}

// One INDEPENDENT window per monitor - "pop out all monitors" is just this
// with every monitor listed. Each entry carries the screen position of its
// navbar zone so each window lands on its own square.
export function launchPipWindows(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new ValidationError("monitors must be a non-empty array");
  }
  const launched = [];
  const alreadyOpen = [];
  for (const entry of entries) {
    const result = launchPipWindow(
      entry.monitor == null ? null : Number(entry.monitor),
      entry.x == null ? null : Number(entry.x),
      entry.y == null ? null : Number(entry.y),
    );
    (result.alreadyOpen ? alreadyOpen : launched).push(result.monitor);
  }
  return { launched, alreadyOpen };
}

// Close every floating window. The tracked children cover what this server
// process spawned; the pkill sweep also reaches instances that outlived a
// server restart (each window is its own detached process, so a restart
// forgets them without closing them). The pattern is the binary's own name,
// which nothing else on the machine runs as.
export function closeAllPipWindows() {
  let closed = 0;
  for (const [key, child] of running) {
    if (child.exitCode === null) {
      try {
        child.kill();
        closed += 1;
      } catch {
        /* already gone */
      }
    }
    running.delete(key);
  }
  spawn("pkill", ["-f", "mywork-monitors"], { stdio: "ignore" }).unref();
  return { closed };
}
