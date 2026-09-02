import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * Microsoft Entra ID OAuth2 authentication handler
 * Implements the authorization code flow for multi-tenant Entra ID
 */

export class EntraIdAuth {
  constructor(config) {
    this.tenantId = config.tenantId;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;

    this.authorityUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0`;
    this.graphApiUrl = 'https://graph.microsoft.com/v1.0';
  }

  /**
   * Generate authorization URL for user to redirect to
   * @param {string} state - CSRF token/state for verification
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'openid profile email offline_access',
      redirect_uri: this.redirectUri,
      state: state,
      prompt: 'select_account'
    });

    return `${this.authorityUrl}/authorize?${params.toString()}`;
  }

  /**
   * Microsoft's token endpoint accepts ONLY
   * application/x-www-form-urlencoded. Passing axios a plain object sends
   * JSON, which it rejects before ever looking at the credentials - so a
   * perfectly correct tenant, client id and secret still fail. Every POST to
   * the authority goes through here so that cannot be got wrong in one place
   * and right in another.
   */
  async _postForm(path, fields) {
    return axios.post(
      `${this.authorityUrl}/${path}`,
      new URLSearchParams(fields).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
  }

  /**
   * Turn an axios failure into a message that says what Entra actually
   * objected to. Microsoft returns { error, error_description } and the
   * description carries the AADSTS code - the single most useful string in
   * the whole flow, and previously discarded in favour of "Failed to
   * exchange authorization code for token".
   *
   * Never includes the client secret: only fields Entra itself sent back.
   */
  static describeAuthError(error, fallback) {
    const data = error.response?.data;
    if (data?.error_description) {
      // The description is multi-line and repeats the correlation id; the
      // first line carries the AADSTS code and the human explanation.
      return String(data.error_description).split(/\r?\n/)[0].trim();
    }
    if (data?.error) return String(data.error);
    if (error.code) return `${error.code} contacting Microsoft`;
    return error.message || fallback;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from redirect
   * @returns {Promise<{accessToken, refreshToken, expiresIn, idToken}>}
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await this._postForm('token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid profile email offline_access'
      });

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        idToken: response.data.id_token
      };
    } catch (error) {
      const detail = EntraIdAuth.describeAuthError(
        error,
        'Failed to exchange authorization code for token'
      );
      console.error('Error exchanging code for token:', detail);
      const wrapped = new Error(detail);
      wrapped.entraDetail = detail;
      throw wrapped;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken
   * @returns {Promise<{accessToken, expiresIn}>}
   */
  async refreshAccessToken(refreshToken) {
    try {
      const response = await this._postForm('token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'openid profile email offline_access'
      });

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      const detail = EntraIdAuth.describeAuthError(
        error,
        'Failed to refresh access token'
      );
      console.error('Error refreshing token:', detail);
      const wrapped = new Error(detail);
      wrapped.entraDetail = detail;
      throw wrapped;
    }
  }

  /**
   * Get user info from Entra ID using access token
   * @param {string} accessToken
   * @returns {Promise<{id, email, displayName, givenName, surname}>}
   */
  async getUserInfo(accessToken) {
    try {
      const response = await axios.get(`${this.graphApiUrl}/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      // BOTH addresses, not one picked for you. In many tenants the UPN
      // (ryan@company.onmicrosoft.com) is not the mail address
      // (ryan@company.com), and collapsing them here means the profile match
      // depends on which of the two someone happened to type into "Email for
      // SSO". Returning both lets ssoIdentityService match on either.
      //
      // `email` is kept as the primary for existing callers, and prefers
      // `mail` because that is the address a person recognises.
      return {
        id: response.data.id,
        email: response.data.mail || response.data.userPrincipalName,
        mail: response.data.mail || null,
        userPrincipalName: response.data.userPrincipalName || null,
        displayName: response.data.displayName,
        givenName: response.data.givenName,
        surname: response.data.surname
      };
    } catch (error) {
      const detail = EntraIdAuth.describeAuthError(
        error,
        'Failed to fetch user information from Microsoft Graph'
      );
      console.error('Error fetching user info:', detail);
      const wrapped = new Error(detail);
      wrapped.entraDetail = detail;
      throw wrapped;
    }
  }

  /**
   * App-only (client credentials) token, for calls made as the application
   * itself rather than as a signed-in user - listing the whole directory is
   * one of these, since `/me` only ever answers for whoever is signed in.
   * Requires the app registration to hold an ADMIN-CONSENTED application
   * permission (User.Read.All or Directory.Read.All); the delegated scopes
   * the sign-in flow uses do not grant this on their own.
   * @returns {Promise<{accessToken, expiresIn}>}
   */
  async getAppOnlyToken() {
    try {
      const response = await this._postForm('token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
        scope: 'https://graph.microsoft.com/.default',
      });

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      const detail = EntraIdAuth.describeAuthError(
        error,
        'Failed to acquire an app-only Microsoft Graph token'
      );
      console.error('Error acquiring app-only token:', detail);
      const wrapped = new Error(detail);
      wrapped.entraDetail = detail;
      throw wrapped;
    }
  }

  /**
   * List every user in the tenant's directory, paging through
   * `@odata.nextLink` until exhausted. Called with an app-only token from
   * getAppOnlyToken() - this is a directory read, not anything scoped to a
   * signed-in person.
   * @param {string} accessToken
   * @returns {Promise<Array<{id, displayName, email}>>}
   */
  async listDirectoryUsers(accessToken) {
    const users = [];
    let url = `${this.graphApiUrl}/users?$select=id,displayName,mail,userPrincipalName&$top=999`;

    try {
      while (url) {
        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        for (const u of response.data.value || []) {
          users.push({
            id: u.id,
            displayName: u.displayName || null,
            // Same preference as getUserInfo(): `mail` is the address a
            // person recognises, the UPN is a fallback for accounts that
            // never had a mailbox address set.
            email: u.mail || u.userPrincipalName || null,
          });
        }
        url = response.data['@odata.nextLink'] || null;
      }
      return users;
    } catch (error) {
      const detail = EntraIdAuth.describeAuthError(
        error,
        'Failed to list users from Microsoft Graph'
      );
      console.error('Error listing directory users:', detail);
      const wrapped = new Error(detail);
      wrapped.entraDetail = detail;
      throw wrapped;
    }
  }

  /**
   * Live directory search - up to `top` users whose name/email matches
   * `query`, ranked by Graph's own relevance. NOT the same as
   * listDirectoryUsers() above, which pages through the WHOLE tenant for the
   * cached directory pull; this is the search-as-you-type backing a
   * Person field.
   * @param {string} accessToken
   * @param {string} query
   * @param {number} top
   * @returns {Promise<Array<{id, displayName, email}>>}
   */
  async searchUsers(accessToken, query, top = 10) {
    return this._searchDirectory('users', 'displayName,mail,userPrincipalName', accessToken, query, top, (u) => ({
      id: u.id,
      displayName: u.displayName || null,
      email: u.mail || u.userPrincipalName || null,
    }));
  }

  /**
   * Live directory search for groups - the Group field's counterpart to
   * searchUsers() above.
   * @param {string} accessToken
   * @param {string} query
   * @param {number} top
   * @returns {Promise<Array<{id, displayName, email}>>}
   */
  async searchGroups(accessToken, query, top = 10) {
    return this._searchDirectory('groups', 'displayName,mail', accessToken, query, top, (g) => ({
      id: g.id,
      displayName: g.displayName || null,
      // Only mail-enabled groups carry an address; a plain security group
      // has none, and that's a normal result, not a broken one.
      email: g.mail || null,
    }));
  }

  /**
   * Shared $search implementation for searchUsers/searchGroups.
   * `$search` needs the `ConsistencyLevel: eventual` header, and ranks by
   * relevance rather than the alphabetical order `$filter startswith` would
   * give - what you want for "type a few letters, see the best matches".
   */
  async _searchDirectory(resource, select, accessToken, query, top, mapItem) {
    // A '"' would terminate the $search expression early, so it's stripped
    // rather than escaped - there's no legitimate name/email that needs one.
    const safeQuery = String(query || '').replace(/"/g, '').trim();
    if (!safeQuery) return [];

    const url = `${this.graphApiUrl}/${resource}?$search="displayName:${safeQuery}"&$select=${select}&$top=${top}`;

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ConsistencyLevel: 'eventual',
        },
      });
      return (response.data.value || []).map(mapItem);
    } catch (error) {
      const detail = EntraIdAuth.describeAuthError(
        error,
        `Failed to search ${resource} in Microsoft Graph`
      );
      console.error(`Error searching ${resource}:`, detail);
      const wrapped = new Error(detail);
      wrapped.entraDetail = detail;
      throw wrapped;
    }
  }

  /**
   * Revoke refresh token (logout)
   * @param {string} refreshToken
   */
  async revokeRefreshToken(refreshToken) {
    try {
      await this._postForm('revoke', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        token: refreshToken,
        token_type_hint: 'refresh_token'
      });
    } catch (error) {
      console.error('Error revoking token:', error.response?.data || error.message);
      // Don't throw - logout should succeed even if revocation fails
    }
  }

  /**
   * Generate a state token for CSRF protection
   * @returns {string}
   */
  static generateState() {
    return uuidv4();
  }
}

export default EntraIdAuth;
