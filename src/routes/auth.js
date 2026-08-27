import express from "express";
import EntraIdAuth from "../auth/entraId.js";
import config from "../config/environment.js";
import { resolveSsoState } from "../services/ssoModeService.js";
import * as ssoIdentityService from "../services/ssoIdentityService.js";
import * as activeUserService from "../services/activeUserService.js";
import logger from "../utils/logger.js";

const router = express.Router();

// The reason string is assembled from config and probe output, never from
// user input - escaped anyway, because "it cannot contain markup today" is
// how it comes to contain markup later.
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );
}

function buildAuth() {
  return new EntraIdAuth({
    tenantId: config.sso.tenantId,
    clientId: config.sso.clientId,
    clientSecret: config.sso.clientSecret,
    redirectUri: config.sso.redirectUri,
  });
}

// Every route here first asks whether SSO is actually in force. With
// SSO_MODE=off these endpoints must not merely fail, they must be absent -
// a login page reachable on the home machine is a login page someone will
// eventually be stuck on.
async function requireSsoEnabled(req, res, next) {
  const state = await resolveSsoState();
  if (!state.enabled) {
    // Plain 404 rather than a rendered template: this path exists to be
    // absent, and adding a whole error view for it would be more surface
    // than the case deserves. `reason` is included because "404" alone is
    // exactly the undiagnosable state this design is trying to avoid.
    return res
      .status(404)
      .type("html")
      .send(
        `<h1>Not found</h1><p>Single sign-on is not enabled on this machine.</p><p>${escapeHtml(state.reason)}</p>`,
      );
  }
  res.locals.ssoState = state;
  next();
}

// The sign-in page. Deliberately a page and not an immediate redirect: an
// instant bounce to Microsoft makes a misconfiguration look like a hang,
// and leaves nowhere to show `reason`.
router.get("/login", requireSsoEnabled, async (req, res) => {
  res.render("pages/login", {
    title: "Sign in",
    appName: config.app.name,
    reason: res.locals.ssoState.reason,
    error: req.query.error || null,
  });
});

// Start the authorization code flow.
router.get("/start", requireSsoEnabled, async (req, res) => {
  const auth = buildAuth();
  const state = EntraIdAuth.generateState();

  req.session.ssoState = { state, at: Date.now() };
  res.redirect(auth.getAuthorizationUrl(state));
});

// Entra redirects back here.
router.get("/callback", requireSsoEnabled, async (req, res) => {
  const { code, state, error: entraError } = req.query;

  if (entraError) {
    logger.warn("SSO callback returned an error", { error: entraError });
    return res.redirect("/auth/login?error=" + encodeURIComponent(entraError));
  }

  // State must match what we issued. Rejecting on mismatch is what stops a
  // forged callback from logging this browser in as somebody else.
  const issued = req.session.ssoState;
  if (!issued || !state || issued.state !== state) {
    return res.redirect("/auth/login?error=state-mismatch");
  }
  delete req.session.ssoState;

  if (!code) {
    return res.redirect("/auth/login?error=no-code");
  }

  try {
    const auth = buildAuth();
    const tokens = await auth.exchangeCodeForToken(code);
    const entraUser = await auth.getUserInfo(tokens.accessToken);

    const { userId } = await ssoIdentityService.resolveIdentityToUser(entraUser);

    // The active profile is SERVER-WIDE (data/active-user.json), because the
    // app holds one connection pool and swaps it on context change - see the
    // Profiles section in CLAUDE.md. Signing in therefore SETS that one
    // value rather than storing a per-session user, which would let two
    // browsers want two databases at the same instant.
    await activeUserService.setActiveUserId(userId);

    req.session.ssoUser = {
      userId,
      subject: entraUser.id,
      displayName: entraUser.displayName,
      email: entraUser.email,
      at: Date.now(),
    };

    logger.info("SSO sign-in complete", { userId });
    res.redirect("/");
  } catch (error) {
    logger.error("SSO callback failed", { error: error.message });
    res.redirect("/auth/login?error=" + encodeURIComponent("sign-in-failed"));
  }
});

// Sign out. Clears the session only - the server-wide active profile is
// left as it is, so signing out does not silently repoint the pool at
// somebody else's database mid-request.
router.post("/logout", async (req, res) => {
  if (req.session) {
    delete req.session.ssoUser;
  }
  res.json({ success: true });
});

router.get("/logout", async (req, res) => {
  if (req.session) {
    delete req.session.ssoUser;
  }
  res.redirect("/auth/login");
});

// Diagnostic: what did SSO_MODE actually resolve to, and why. This is the
// answer to "is it off because I am at home, or off because it is broken",
// and it is why the mode is three-state rather than a boolean.
router.get("/status", async (req, res) => {
  const state = await resolveSsoState({ forceProbe: req.query.probe === "1" });
  res.json({
    success: true,
    data: {
      intent: state.intent,
      enabled: state.enabled,
      configured: state.configured,
      misconfigured: Boolean(state.misconfigured),
      cached: Boolean(state.cached),
      reason: state.reason,
      signedIn: Boolean(req.session?.ssoUser),
      // Never the tenant id, client id or secret - a diagnostic endpoint is
      // not a place to echo credentials.
      displayName: req.session?.ssoUser?.displayName || null,
    },
  });
});

export default router;
