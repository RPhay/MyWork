import * as db from '../database/connectionPool.js';
import { ValidationError, NotFoundError, AppError } from '../config/errors.js';

const TICKET_TYPES = ['ServiceNow', 'Azure DevOps', 'Other'];

export async function getTickets(contextId) {
  const [tickets] = await db.query(
    'SELECT * FROM tickets WHERE context_id = ? ORDER BY created_at DESC',
    [contextId]
  );

  for (const ticket of tickets) {
    const [links] = await db.query(
      'SELECT id, url, title FROM ticket_links WHERE ticket_id = ? ORDER BY order_index ASC',
      [ticket.id]
    );
    ticket.links = links || [];
  }

  return tickets;
}

export async function getTicket(ticketId, contextId) {
  const [tickets] = await db.query(
    'SELECT * FROM tickets WHERE id = ? AND context_id = ?',
    [ticketId, contextId]
  );

  if (!tickets || tickets.length === 0) {
    throw new NotFoundError('Ticket not found');
  }

  const ticket = tickets[0];
  const [links] = await db.query(
    'SELECT id, url, title FROM ticket_links WHERE ticket_id = ? ORDER BY order_index ASC',
    [ticket.id]
  );
  ticket.links = links || [];

  return ticket;
}

export async function createTicket(data, contextId) {
  const { title, notes, ticket_type } = data;

  if (!title?.trim()) {
    throw new ValidationError('Title is required');
  }

  if (!TICKET_TYPES.includes(ticket_type)) {
    throw new ValidationError(`Invalid ticket type: ${ticket_type}`);
  }

  const [result] = await db.query(
    'INSERT INTO tickets (title, notes, ticket_type, context_id) VALUES (?, ?, ?, ?)',
    [title.trim(), notes || '', ticket_type, contextId]
  );

  return getTicket(result.insertId, contextId);
}

export async function updateTicket(ticketId, data, contextId) {
  const { title, notes, ticket_type } = data;

  if (!title?.trim()) {
    throw new ValidationError('Title is required');
  }

  if (!TICKET_TYPES.includes(ticket_type)) {
    throw new ValidationError(`Invalid ticket type: ${ticket_type}`);
  }

  // Verify ticket exists in this context
  await getTicket(ticketId, contextId);

  await db.query(
    'UPDATE tickets SET title = ?, notes = ?, ticket_type = ? WHERE id = ? AND context_id = ?',
    [title.trim(), notes || '', ticket_type, ticketId, contextId]
  );

  return getTicket(ticketId, contextId);
}

export async function deleteTicket(ticketId, contextId) {
  // Verify ticket exists in this context
  await getTicket(ticketId, contextId);

  await db.query('DELETE FROM tickets WHERE id = ? AND context_id = ?', [ticketId, contextId]);
}

export async function addTicketLink(ticketId, url, title, contextId) {
  if (!url?.trim()) {
    throw new ValidationError('URL is required');
  }

  // Verify ticket exists in this context
  await getTicket(ticketId, contextId);

  // Get the next order index
  const [[{ maxIndex }]] = await db.query(
    'SELECT COALESCE(MAX(order_index), -1) as maxIndex FROM ticket_links WHERE ticket_id = ?',
    [ticketId]
  );

  const [result] = await db.query(
    'INSERT INTO ticket_links (ticket_id, url, title, order_index) VALUES (?, ?, ?, ?)',
    [ticketId, url.trim(), title?.trim() || '', maxIndex + 1]
  );

  return {
    id: result.insertId,
    url: url.trim(),
    title: title?.trim() || '',
    order_index: maxIndex + 1
  };
}

export async function removeTicketLink(linkId, ticketId, contextId) {
  // Verify ticket exists in this context
  await getTicket(ticketId, contextId);

  const [result] = await db.query(
    'DELETE FROM ticket_links WHERE id = ? AND ticket_id = ?',
    [linkId, ticketId]
  );

  if (result.affectedRows === 0) {
    throw new NotFoundError('Link not found');
  }
}

export function getTicketTypes() {
  return TICKET_TYPES;
}
