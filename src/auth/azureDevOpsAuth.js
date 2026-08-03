import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * Azure DevOps OAuth2 authentication handler
 */

export class AzureDevOpsAuth {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.organizationUrl = config.organizationUrl; // e.g., https://dev.azure.com/myorg

    this.authorityUrl = 'https://app.vssps.visualstudio.com/oauth2/authorize';
    this.tokenUrl = 'https://app.vssps.visualstudio.com/oauth2/token';
    this.apiUrl = 'https://app.vssps.visualstudio.com/_apis';
  }

  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'Assertion',
      scope: 'vso.work vso.code vso.release',
      redirect_uri: this.redirectUri,
      state: state
    });

    return `${this.authorityUrl}?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(this.tokenUrl,
        new URLSearchParams({
          client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          client_assertion: this.clientSecret,
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: code,
          redirect_uri: this.redirectUri
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for token');
    }
  }

  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post(this.tokenUrl,
        new URLSearchParams({
          client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          client_assertion: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          redirect_uri: this.redirectUri
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

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
      const response = await axios.get(`${this.apiUrl}/profile/profiles/me?api-version=1.0`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const profile = response.data;
      return {
        id: profile.id,
        email: profile.emailAddress,
        displayName: profile.displayName,
        coreRevision: profile.coreRevision
      };
    } catch (error) {
      console.error('Error fetching user info:', error.response?.data || error.message);
      throw new Error('Failed to fetch user information');
    }
  }

  async revokeRefreshToken(refreshToken) {
    try {
      await axios.post(`${this.apiUrl}/tokens/revoke`, {
        refreshToken: refreshToken
      }, {
        headers: { 'Authorization': `Bearer ${this.clientSecret}` }
      });
    } catch (error) {
      console.error('Error revoking token:', error.response?.data || error.message);
    }
  }

  static generateState() {
    return uuidv4();
  }
}

export default AzureDevOpsAuth;
