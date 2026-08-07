import express from 'express';
import * as ticketService from '../../services/ticketService.js';
import { AppError } from '../../config/errors.js';

const router = express.Router();

// Get all tickets for current context
router.get('/', async (req, res, next) => {
  try {
    const tickets = await ticketService.getTickets(req.session.contextId);
    res.json({ success: true, data: tickets });
  } catch (error) {
    next(error);
  }
});

// Get single ticket
router.get('/:id', async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicket(parseInt(req.params.id), req.session.contextId);
    res.json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
});

// Create ticket
router.post('/', async (req, res, next) => {
  try {
    const ticket = await ticketService.createTicket(req.body, req.session.contextId);
    res.json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
});

// Update ticket
router.put('/:id', async (req, res, next) => {
  try {
    const ticket = await ticketService.updateTicket(parseInt(req.params.id), req.body, req.session.contextId);
    res.json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
});

// Delete ticket
router.delete('/:id', async (req, res, next) => {
  try {
    await ticketService.deleteTicket(parseInt(req.params.id), req.session.contextId);
    res.json({ success: true, message: 'Ticket deleted' });
  } catch (error) {
    next(error);
  }
});

// Get ticket types
router.get('/types/list', (req, res) => {
  const types = ticketService.getTicketTypes();
  res.json({ success: true, data: types });
});

// Add link to ticket
router.post('/:id/links', async (req, res, next) => {
  try {
    const { url, title } = req.body;
    const link = await ticketService.addTicketLink(parseInt(req.params.id), url, title, req.session.contextId);
    res.json({ success: true, data: link });
  } catch (error) {
    next(error);
  }
});

// Remove link from ticket
router.delete('/:id/links/:linkId', async (req, res, next) => {
  try {
    await ticketService.removeTicketLink(parseInt(req.params.linkId), parseInt(req.params.id), req.session.contextId);
    res.json({ success: true, message: 'Link removed' });
  } catch (error) {
    next(error);
  }
});

export default router;
