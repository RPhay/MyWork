import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * ServiceNow OAuth2 authentication handler
 */

export class ServiceNowAuth {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.instanceUrl = config.instanceUrl; // e.g., https://mycompany.service-now.com

    this.authorityUrl = `${this.instanceUrl}/oauth_authorize.do`;
    this.tokenUrl = `${this.instanceUrl}/oauth_token.do`;
    this.apiUrl = `${this.instanceUrl}/api/now/v2`;
  }

  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      state: state
    });

    return `${this.authorityUrl}?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(this.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: code,
          redirect_uri: this.redirectUri
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type
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
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken
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
      const response = await axios.get(`${this.apiUrl}/table/sys_user?sysparm_limit=1&sysparm_fields=sys_id,name,email,user_name`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      const user = response.data.result[0];
      return {
        id: user.sys_id,
        email: user.email,
        displayName: user.name,
        userName: user.user_name
      };
    } catch (error) {
      console.error('Error fetching user info:', error.response?.data || error.message);
      throw new Error('Failed to fetch user information');
    }
  }

  async revokeToken(accessToken) {
    try {
      await axios.post(`${this.instanceUrl}/oauth_revoke.do`, {
        token: accessToken
      }, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        }
      });
    } catch (error) {
      console.error('Error revoking token:', error.response?.data || error.message);
    }
  }

  static generateState() {
    return uuidv4();
  }
}

export default ServiceNowAuth;
