import * as db from '../database/connectionPool.js';
import { ValidationError, NotFoundError, AppError } from '../config/errors.js';

const TICKET_TYPES = ['ServiceNow', 'Azure DevOps', 'Other'];

export async function getTickets(contextId) {
  const tickets = await db.query(
    'SELECT * FROM tickets WHERE context_id = ? ORDER BY created_at DESC',
    [contextId]
  );

  for (const ticket of tickets) {
    const links = await db.query(
      'SELECT id, url, title FROM ticket_links WHERE ticket_id = ? ORDER BY order_index ASC',
      [ticket.id]
    );
    ticket.links = links || [];
  }

  return tickets;
}

export async function getTicket(ticketId, contextId) {
  const tickets = await db.query(
    'SELECT * FROM tickets WHERE id = ? AND context_id = ?',
    [ticketId, contextId]
  );

  if (!tickets || tickets.length === 0) {
    throw new NotFoundError('Ticket not found');
  }

  const ticket = tickets[0];
  const links = await db.query(
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

  const ticketId = await db.insert(
    'INSERT INTO tickets (title, notes, ticket_type, context_id) VALUES (?, ?, ?, ?)',
    [title.trim(), notes || '', ticket_type, contextId]
  );

  return getTicket(ticketId, contextId);
}

export async function updateTicket(ticketId, data, contextId) {
  const { title, notes, ticket_type, priority_id } = data;

  // Verify ticket exists in this context
  const ticket = await getTicket(ticketId, contextId);

  const setClauses = [];
  const values = [];

  // Only update title if provided and non-empty
  if (title !== undefined) {
    if (!title?.trim()) {
      throw new ValidationError('Title is required');
    }
    setClauses.push('title = ?');
    values.push(title.trim());
  }

  // Only update notes if provided
  if (notes !== undefined) {
    setClauses.push('notes = ?');
    values.push(notes || '');
  }

  // Only update ticket_type if provided
  if (ticket_type !== undefined) {
    if (!TICKET_TYPES.includes(ticket_type)) {
      throw new ValidationError(`Invalid ticket type: ${ticket_type}`);
    }
    setClauses.push('ticket_type = ?');
    values.push(ticket_type);
  } else if (!title && !notes && priority_id === undefined) {
    // If only updating via drag-to-associate, ensure ticket_type is set
    throw new ValidationError('At least one field must be provided');
  }

  // Only update priority_id if provided
  if (priority_id !== undefined) {
    setClauses.push('priority_id = ?');
    values.push(priority_id || null);
  }

  // If no fields to update, throw error
  if (setClauses.length === 0) {
    throw new ValidationError('At least one field must be provided');
  }

  values.push(ticketId, contextId);
  await db.update(
    `UPDATE tickets SET ${setClauses.join(', ')} WHERE id = ? AND context_id = ?`,
    values
  );

  return getTicket(ticketId, contextId);
}

export async function deleteTicket(ticketId, contextId) {
  // Verify ticket exists in this context
  await getTicket(ticketId, contextId);

  await db.deleteRecord('DELETE FROM tickets WHERE id = ? AND context_id = ?', [ticketId, contextId]);
}

export async function addTicketLink(ticketId, url, title, contextId) {
  if (!url?.trim()) {
    throw new ValidationError('URL is required');
  }

  // Verify ticket exists in this context
  await getTicket(ticketId, contextId);

  // Get the next order index
  const rows = await db.query(
    'SELECT COALESCE(MAX(order_index), -1) as maxIndex FROM ticket_links WHERE ticket_id = ?',
    [ticketId]
  );
  const maxIndex = rows[0]?.maxIndex ?? -1;

  const linkId = await db.insert(
    'INSERT INTO ticket_links (ticket_id, url, title, order_index) VALUES (?, ?, ?, ?)',
    [ticketId, url.trim(), title?.trim() || '', maxIndex + 1]
  );

  return {
    id: linkId,
    url: url.trim(),
    title: title?.trim() || '',
    order_index: maxIndex + 1
  };
}

export async function removeTicketLink(linkId, ticketId, contextId) {
  // Verify ticket exists in this context
  await getTicket(ticketId, contextId);

  const affectedRows = await db.deleteRecord(
    'DELETE FROM ticket_links WHERE id = ? AND ticket_id = ?',
    [linkId, ticketId]
  );

  if (affectedRows === 0) {
    throw new NotFoundError('Link not found');
  }
}

export function getTicketTypes() {
  return TICKET_TYPES;
}
