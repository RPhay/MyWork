import express from 'express';
import * as sourceService from '../../services/sourceService.js';
import * as activeContextService from '../../services/activeContextService.js';
import * as dataSourceAuthService from '../../services/dataSourceAuthService.js';
import logger from '../../utils/logger.js';
import axios from 'axios';

const router = express.Router();

// Get all sources
router.get('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const sources = await sourceService.getAllSources(contextId);
    res.json({ success: true, data: sources });
  } catch (error) {
    logger.error('Error fetching sources:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single source
router.get('/:id', async (req, res) => {
  try {
    const source = await sourceService.getSourceById(req.params.id);
    res.json({ success: true, data: source });
  } catch (error) {
    logger.error('Error fetching source:', error);
    res.status(404).json({ success: false, message: error.message });
  }
});

// Create source
router.post('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const source = await sourceService.createSource(req.body, contextId);
    res.status(201).json({ success: true, message: 'Source created', data: source });
  } catch (error) {
    logger.error('Error creating source:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update source
router.put('/:id', async (req, res) => {
  try {
    const source = await sourceService.updateSource(req.params.id, req.body);
    res.json({ success: true, message: 'Source updated', data: source });
  } catch (error) {
    logger.error('Error updating source:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete source
router.delete('/:id', async (req, res) => {
  try {
    await sourceService.deleteSource(req.params.id);
    res.json({ success: true, message: 'Source deleted' });
  } catch (error) {
    logger.error('Error deleting source:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Test source connection
router.post('/:id/test', async (req, res) => {
  try {
    const result = await sourceService.testSourceConnection(req.params.id);
    res.json(result);
  } catch (error) {
    logger.error('Error testing source:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get emails from Outlook for a specific date
router.get('/:id/emails', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!id || !date) {
      return res.status(400).json({
        success: false,
        message: 'Missing id or date parameter'
      });
    }

    // Get the source to verify it's Outlook
    const source = await sourceService.getSourceById(id);
    if (source.type !== 'outlook') {
      return res.status(400).json({
        success: false,
        message: 'This data source is not Outlook'
      });
    }

    // Get the source auth
    const sourceAuth = await dataSourceAuthService.getSourceAuth(id, 'sso_entra_id');

    if (!sourceAuth || !dataSourceAuthService.isAuthValid(sourceAuth)) {
      return res.status(401).json({
        success: false,
        message: 'Authentication expired or not configured'
      });
    }

    // Fetch emails from Outlook
    const emails = await fetchOutlookEmails(sourceAuth.authData.accessToken, date);

    res.json({
      success: true,
      data: emails
    });
  } catch (error) {
    logger.error('Error fetching emails:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch emails'
    });
  }
});

/**
 * Fetch emails from Outlook Graph API for a specific date
 */
async function fetchOutlookEmails(accessToken, dateStr) {
  try {
    const startDate = new Date(dateStr);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(dateStr);
    endDate.setUTCHours(23, 59, 59, 999);

    const filter = `receivedDateTime ge ${startDate.toISOString()} and receivedDateTime le ${endDate.toISOString()}`;

    const response = await axios.get('https://graph.microsoft.com/v1.0/me/messages', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        $filter: filter,
        $select: 'id,subject,from,bodyPreview,body,receivedDateTime',
        $orderby: 'receivedDateTime DESC',
        $top: 50
      }
    });

    return (response.data.value || []).map(email => ({
      id: email.id,
      subject: email.subject || '(No subject)',
      from: email.from?.emailAddress?.address || 'Unknown',
      bodyPreview: email.bodyPreview || '',
      body: email.body?.content || '',
      receivedDateTime: email.receivedDateTime
    }));
  } catch (error) {
    logger.error('Error calling Microsoft Graph API:', error.response?.data || error.message);
    throw new Error('Failed to fetch emails from Outlook');
  }
}

export default router;
