import express from 'express';
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
 *   - redirects are not followed, so a public URL cannot bounce to a private one
 *   - a short timeout and a read cap, so a slow or endless response cannot tie
 *     up the process
 *   - only the title is ever returned; the body is never stored or echoed
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

  try {
    const { address } = await lookup(parsed.hostname);
    if (isPrivateAddress(address)) {
      return res.status(400).json({ success: false, message: 'Refusing to fetch a private address' });
    }
  } catch {
    return res.status(400).json({ success: false, message: 'Could not resolve that host' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(parsed.href, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });

    const type = response.headers.get('content-type') || '';
    if (!response.ok || !type.includes('html')) {
      return res.json({ success: true, data: { title: null } });
    }

    // Read only as far as the title can reasonably be, then stop.
    const reader = response.body?.getReader();
    let html = '';
    let read = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value.length;
      html += Buffer.from(value).toString('utf8');
      if (html.includes('</title>') || read >= MAX_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
    }

    return res.json({ success: true, data: { title: extractTitle(html) } });
  } catch (error) {
    logger.warn(`link-title: could not read ${parsed.hostname}: ${error.message}`);
    return res.json({ success: true, data: { title: null } });
  } finally {
    clearTimeout(timer);
  }
});

export default router;
