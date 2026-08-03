import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * Microsoft Outlook OAuth2 authentication handler
 * Uses Entra ID (same as Teams)
 */

export class MsOutlookAuth {
  constructor(config) {
    this.tenantId = config.tenantId || 'common';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;

    this.authorityUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0`;
    this.graphApiUrl = 'https://graph.microsoft.com/v1.0';
  }

  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'Mail.Read Mail.ReadWrite Calendar.Read Calendar.ReadWrite offline_access',
      redirect_uri: this.redirectUri,
      state: state,
      prompt: 'select_account'
    });

    return `${this.authorityUrl}/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(`${this.authorityUrl}/token`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        scope: 'Mail.Read Mail.ReadWrite Calendar.Read Calendar.ReadWrite offline_access'
      });

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        idToken: response.data.id_token
      };
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for token');
    }
  }

  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post(`${this.authorityUrl}/token`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'Mail.Read Mail.ReadWrite Calendar.Read Calendar.ReadWrite offline_access'
      });

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('Error refreshing token:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  async getUserInfo(accessToken) {
    try {
      const response = await axios.get(`${this.graphApiUrl}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      return {
        id: response.data.id,
        email: response.data.userPrincipalName || response.data.mail,
        displayName: response.data.displayName,
        givenName: response.data.givenName,
        surname: response.data.surname
      };
    } catch (error) {
      console.error('Error fetching user info:', error.response?.data || error.message);
      throw new Error('Failed to fetch user information');
    }
  }

  async revokeRefreshToken(refreshToken) {
    try {
      await axios.post(`${this.authorityUrl}/revoke`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        token: refreshToken,
        token_type_hint: 'refresh_token'
      });
    } catch (error) {
      console.error('Error revoking token:', error.response?.data || error.message);
    }
  }

  static generateState() {
    return uuidv4();
  }
}

export default MsOutlookAuth;
