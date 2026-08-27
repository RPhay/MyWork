import axios from 'axios';
import config from '../config/environment.js';
import logger from '../utils/logger.js';

/**
 * Resolves whether single sign-on is actually in force right now.
 *
 * SSO_MODE is the user's INTENT ('off' | 'on' | 'auto'); this module turns
 * that into the EFFECTIVE state, which is a different thing whenever the
 * intent cannot be honoured - 'on' with no client id configured is not on,
 * it is misconfigured, and saying so is the entire point of this file.
 *
 * Every answer carries a `reason`. That is not decoration: the failure this
 * design exists to prevent is a login switch that is silently off, which is
 * indistinguishable from a broken one unless the app can say WHY.
 */

const MODE_OFF = 'off';
const MODE_ON = 'on';
const MODE_AUTO = 'auto';

// Cache for the 'auto' reachability probe. A login gate runs on every page
// request, so probing Microsoft each time would put a network round trip in
// front of the whole app.
let probeCache = null;

/**
 * Is the tenant configured well enough for a login to be possible at all?
 * Checked before any probe: an unreachable network and an unconfigured app
 * are different problems and must not report the same way.
 */
export function getConfigurationState() {
  const { tenantId, clientId, clientSecret, redirectUri } = config.sso;
  const missing = [];
  if (!tenantId) missing.push('SSO_TENANT_ID');
  if (!clientId) missing.push('SSO_CLIENT_ID');
  if (!clientSecret) missing.push('SSO_CLIENT_SECRET');
  if (!redirectUri) missing.push('SSO_REDIRECT_URI');
  return { configured: missing.length === 0, missing };
}

/**
 * Can this machine reach the tenant's Entra endpoint?
 *
 * Deliberately requests the OpenID discovery document rather than pinging a
 * host: a home network can resolve login.microsoftonline.com perfectly well,
 * so DNS proves nothing. What matters is whether THIS tenant answers.
 */
async function probeTenantReachable() {
  const { tenantId, probeTimeoutMs } = config.sso;
  const url = `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`;

  try {
    const response = await axios.get(url, {
      timeout: probeTimeoutMs,
      // A redirect to a captive portal is not the tenant answering.
      maxRedirects: 0,
      validateStatus: (status) => status === 200,
    });
    return { reachable: response.status === 200, detail: 'tenant responded' };
  } catch (error) {
    return {
      reachable: false,
      // error.code for a timeout/DNS failure, error.message otherwise - the
      // response body is not included, it can carry tenant detail.
      detail: error.code || 'tenant did not respond',
    };
  }
}

/**
 * The whole decision, as one object. Callers should treat `enabled` as
 * authoritative and `reason` as the thing to SHOW someone.
 */
export async function resolveSsoState({ forceProbe = false } = {}) {
  const intent = config.sso.mode;

  if (intent === MODE_OFF) {
    return {
      intent,
      enabled: false,
      reason: 'SSO_MODE is off - this machine does not use single sign-on.',
      configured: getConfigurationState().configured,
    };
  }

  const { configured, missing } = getConfigurationState();

  if (!configured) {
    // 'on' cannot be honoured. Refusing to enable is the safe direction: the
    // alternative is a login gate that redirects to an authorize URL built
    // from undefined, locking the user out of their own app.
    return {
      intent,
      enabled: false,
      reason: `SSO_MODE is ${intent} but the tenant is not configured - missing ${missing.join(', ')}.`,
      configured: false,
      misconfigured: true,
    };
  }

  if (intent === MODE_ON) {
    return {
      intent,
      enabled: true,
      reason: 'SSO_MODE is on - single sign-on is required on this machine.',
      configured: true,
    };
  }

  if (intent !== MODE_AUTO) {
    // Unreachable while normaliseSsoMode() is the only writer of this value,
    // which is the point of routing every read through it. Handled anyway,
    // and handled as OFF, because a mode this code does not understand must
    // not be allowed to demand a login.
    return {
      intent,
      enabled: false,
      reason: `SSO_MODE '${intent}' is not a mode this build understands - treating as off.`,
      configured: true,
      misconfigured: true,
    };
  }

  // MODE_AUTO from here: let reachability decide.
  const now = Date.now();
  if (!forceProbe && probeCache && now - probeCache.at < config.sso.probeCacheMs) {
    return {
      intent,
      enabled: probeCache.reachable,
      reason: probeCache.reachable
        ? `SSO_MODE is auto and the tenant is reachable (${probeCache.detail}, cached).`
        : `SSO_MODE is auto and the tenant is unreachable (${probeCache.detail}, cached) - continuing without single sign-on.`,
      configured: true,
      cached: true,
    };
  }

  const { reachable, detail } = await probeTenantReachable();
  probeCache = { at: now, reachable, detail };

  logger.info('SSO auto-mode probe', { reachable, detail });

  return {
    intent,
    enabled: reachable,
    reason: reachable
      ? `SSO_MODE is auto and the tenant is reachable (${detail}).`
      : `SSO_MODE is auto and the tenant is unreachable (${detail}) - continuing without single sign-on.`,
    configured: true,
    cached: false,
  };
}

/** Convenience for the gate, which only needs the boolean. */
export async function isSsoEnabled() {
  const { enabled } = await resolveSsoState();
  return enabled;
}

/** Test/diagnostic seam - forget any cached probe result. */
export function clearProbeCache() {
  probeCache = null;
}
