import express from 'express';
import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import logger from '../../utils/logger.js';

const router = express.Router();

/**
 * Resolves a URL's page title, so a link dropped onto a row is named the way
 * its browser tab is rather than showing a raw URL.
 *
 * This has to happen server-side: the browser cannot read a cross-origin
 * document's <title>.
 *
 * That makes it a request THIS SERVER makes to an address the caller chooses,
 * which is server-side request forgery unless it is constrained. The guards:
 *
 *   - http/https only, so file://, gopher:// and friends are out
 *   - the resolved IP must be public - private, loopback, link-local and
 *     unique-local ranges are refused, which is what stops it being used to
 *     probe localhost or the LAN from inside the network
 *   - the connection is PINNED to that same resolved IP - see "pinned lookup"
 *     below for why a second, unchecked resolution would undo this guard
 *   - redirects are not followed, so a public URL cannot bounce to a private one
 *   - a short timeout and a read cap, so a slow or endless response cannot tie
 *     up the process
 *   - only the title is ever returned; the body is never stored or echoed
 *
 * Pinned lookup: `fetch()` cannot be told to use an address it didn't resolve
 * itself, so checking the IP with dns.lookup() and then calling fetch(url) is
 * TWO separate resolutions - a hostname an attacker controls can answer the
 * first with a public IP (passing the check) and the second, moments later,
 * with 127.0.0.1 or a cloud metadata address, and the fetch goes there
 * (DNS rebinding). Node's http/https modules take a `lookup` option; passing
 * one that always returns the address already validated - never re-resolving
 * the hostname - closes that window. `Host` stays the real hostname so the
 * origin server still serves the right site.
 */

const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;

function isPrivateAddress(ip) {
  if (ip.includes(':')) {
    const v6 = ip.toLowerCase();
    if (v6 === '::1' || v6 === '::') return true;
    if (v6.startsWith('fe80') || v6.startsWith('fc') || v6.startsWith('fd')) return true;
    // IPv4-mapped IPv6 (::ffff:10.0.0.1) must be judged on the IPv4 part.
    const mapped = v6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 169 && p[1] === 254) return true;   // link-local, incl. cloud metadata
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
  return false;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i);
  if (!m) return null;
  return m[1]
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .trim()
    .slice(0, 200) || null;
}

// GET /api/link-title?url=... -> { success, data: { title } }
// `title` is null when the page has none or could not be read; the caller then
// falls back to the hostname, so a failure here is never fatal to a drop.
router.get('/', async (req, res) => {
  const raw = String(req.query.url || '');
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return res.status(400).json({ success: false, message: 'Not a URL' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ success: false, message: 'Only http and https are supported' });
  }

  let pinnedAddress;
  let pinnedFamily;
  try {
    const resolved = await lookup(parsed.hostname);
    if (isPrivateAddress(resolved.address)) {
      return res.status(400).json({ success: false, message: 'Refusing to fetch a private address' });
    }
    pinnedAddress = resolved.address;
    pinnedFamily = resolved.family;
  } catch {
    return res.status(400).json({ success: false, message: 'Could not resolve that host' });
  }

  // Always hands back the address checked above, whatever hostname is asked
  // for - the one thing standing between this and a second, unchecked
  // resolution an attacker's DNS could answer differently.
  // Node's own connect logic asks for `{ all: true }` (its happy-eyeballs
  // multi-address path) and then expects the ARRAY form of the callback -
  // calling back with a bare (address, family) triple here throws
  // "Invalid IP address: undefined" deep inside net.connect. Both forms hand
  // back the one address already checked; there is never a second candidate
  // to fall back to.
  const pinnedLookup = (_hostname, options, callback) => (
    options?.all
      ? callback(null, [{ address: pinnedAddress, family: pinnedFamily }])
      : callback(null, pinnedAddress, pinnedFamily)
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const requestModule = parsed.protocol === 'https:' ? https : http;

  try {
    const html = await new Promise((resolve, reject) => {
      const request = requestModule.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: `${parsed.pathname}${parsed.search}`,
          method: 'GET',
          // `parsed.host`, not `.hostname`: it carries a non-default port too.
          headers: { Accept: 'text/html,application/xhtml+xml', Host: parsed.host },
          signal: controller.signal,
          lookup: pinnedLookup,
        },
        (response) => {
          const type = response.headers['content-type'] || '';
          const ok = response.statusCode >= 200 && response.statusCode < 300;
          if (!ok || !type.includes('html')) {
            response.destroy();
            return resolve(null);
          }

          // Read only as far as the title can reasonably be, then stop. A
          // stop via destroy() never fires 'end' - it's an abandoned read,
          // not a natural close - so the early-stop case resolves right where
          // it decides to stop rather than waiting on an event that an
          // intentional destroy() guarantees will not come.
          let body = '';
          let read = 0;
          let settled = false;
          const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            read += Buffer.byteLength(chunk);
            body += chunk;
            if (body.includes('</title>') || read >= MAX_BYTES) {
              response.destroy();
              finish(body);
            }
          });
          response.on('end', () => finish(body));
          response.on('error', (err) => { if (!settled) reject(err); });
        },
      );
      // Redirects are never followed - the request callback above only ever
      // sees the FIRST response, 3xx included, and `ok` above rejects it.
      request.on('error', reject);
      request.end();
    });

    return res.json({ success: true, data: { title: html === null ? null : extractTitle(html) } });
  } catch (error) {
    logger.warn(`link-title: could not read ${parsed.hostname}: ${error.message}`);
    return res.json({ success: true, data: { title: null } });
  } finally {
    clearTimeout(timer);
  }
});

export default router;
