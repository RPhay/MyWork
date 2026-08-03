import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * GitHub Enterprise OAuth2 authentication handler
 */

export class GitHubEnterpriseAuth {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.enterpriseUrl = config.enterpriseUrl; // e.g., https://github.enterprise.com

    this.authorityUrl = `${this.enterpriseUrl}/login/oauth/authorize`;
    this.tokenUrl = `${this.enterpriseUrl}/login/oauth/access_token`;
    this.apiUrl = `${this.enterpriseUrl}/api/v3`;
  }

  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'repo read:user read:org',
      state: state,
      allow_signup: 'false'
    });

    return `${this.authorityUrl}?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(this.tokenUrl, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri
      }, {
        headers: { 'Accept': 'application/json' }
      });

      return {
        accessToken: response.data.access_token,
        tokenType: response.data.token_type || 'bearer',
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for token');
    }
  }

  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post(this.tokenUrl, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }, {
        headers: { 'Accept': 'application/json' }
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
      const response = await axios.get(`${this.apiUrl}/user`, {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      return {
        id: response.data.id,
        email: response.data.email,
        displayName: response.data.name,
        login: response.data.login,
        avatar: response.data.avatar_url
      };
    } catch (error) {
      console.error('Error fetching user info:', error.response?.data || error.message);
      throw new Error('Failed to fetch user information');
    }
  }

  async revokeToken(accessToken) {
    try {
      await axios.delete(`${this.apiUrl}/applications/${this.clientId}/grants`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        data: { access_token: accessToken }
      });
    } catch (error) {
      console.error('Error revoking token:', error.response?.data || error.message);
    }
  }

  static generateState() {
    return uuidv4();
  }
}

export default GitHubEnterpriseAuth;
