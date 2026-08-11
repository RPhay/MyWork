// Shared utilities for handling email and calendar drag-and-drop

// Parse calendar events (both iCalendar and Outlook plain text formats)
function parseCalendarEvent(text) {
  const event = {
    title: '',
    description: '',
    duration: null
  };

  // Check if this is iCalendar format
  if (text.includes('BEGIN:VEVENT') || text.includes('DTSTART')) {
    return parseICalendarFormat(text);
  }

  // Otherwise, parse Outlook plain text format
  return parseOutlookPlainTextFormat(text);
}

function parseICalendarFormat(text) {
  const lines = text.split(/[\r\n]+/).filter(line => line.trim());
  const event = {
    title: '',
    description: '',
    duration: null,
    startTime: null
  };

  let dtStart = null;
  let dtEnd = null;

  for (const line of lines) {
    if (line.startsWith('SUMMARY:')) {
      event.title = line.substring(8).trim();
    } else if (line.startsWith('DESCRIPTION:')) {
      event.description = line.substring(12).trim();
    } else if (line.startsWith('DTSTART')) {
      const match = line.match(/DTSTART(?:;[^:]*)?:(.+)/);
      if (match) dtStart = parseICalDate(match[1]);
    } else if (line.startsWith('DTEND')) {
      const match = line.match(/DTEND(?:;[^:]*)?:(.+)/);
      if (match) dtEnd = parseICalDate(match[1]);
    }
  }

  if (dtStart && dtEnd) {
    event.duration = Math.round((dtEnd - dtStart) / 60000);
    const hours = dtStart.getHours();
    const minutes = dtStart.getMinutes();
    event.startTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return event;
}

function parseOutlookPlainTextFormat(text) {
  const event = {
    title: '',
    description: '',
    duration: null,
    startTime: null
  };

  const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l);

  if (lines.length === 0) return event;

  // First line is the title
  event.title = lines[0];

  // Look for "When:" line and parse time
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('When:')) {
      const whenText = line.substring(5).trim();
      const timeData = parseOutlookTimeRange(whenText);
      if (timeData !== null) {
        event.duration = timeData.duration;
        event.startTime = timeData.startTime;
      }
    } else if (line.startsWith('Location:')) {
      const location = line.substring(9).trim();
      if (location) {
        event.description = location + (event.description ? '\n' + event.description : '');
      }
    } else if (line.startsWith('Organizer:') || line.startsWith('Attendees:')) {
      // Skip these lines
      continue;
    } else if (event.description === '' && !line.includes(':')) {
      // Treat non-field lines as description
      event.description = line;
    }
  }

  return event;
}

function parseOutlookTimeRange(timeStr) {
  // Examples:
  // "Monday, August 3, 2026 at 12:15 PM - 12:45 PM"
  // "August 3, 2026 at 9:00 AM - 10:30 AM"
  // "Monday, August 3, 2026 2:00 PM - 3:00 PM"
  // "Monday, August 3, 2026 2:00 PM"

  // Try to match time range pattern: "HH:MM [AM/PM] - HH:MM [AM/PM]"
  let timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i);
  if (!timeMatch) {
    // Try alternate pattern without first AM/PM (Outlook sometimes omits it): "HH:MM - HH:MM AM/PM"
    timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i);
    if (timeMatch) {
      // Rearrange to match the expected structure
      const startHour = parseInt(timeMatch[1]);
      const startMin = parseInt(timeMatch[2]);
      const endHour = parseInt(timeMatch[3]);
      const endMin = parseInt(timeMatch[4]);
      const endPeriod = timeMatch[5].toUpperCase();

      // Determine the period for start time based on end period
      let startPeriod = endPeriod;
      // If start hour > end hour and both in same period, start must be in different period
      if (startHour > endHour && endPeriod === 'PM') {
        startPeriod = 'AM';
      }

      timeMatch = [null, startHour, startMin, startPeriod, endHour, endMin, endPeriod];
    } else {
      // Try single time (no end time): "HH:MM [AM/PM]"
      timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
      if (timeMatch) {
        const startHour = parseInt(timeMatch[1]);
        const startMin = parseInt(timeMatch[2]);
        const startPeriod = (timeMatch[3] || 'AM').toUpperCase();

        // Without end time, assume default 1 hour duration
        let start24Hour = startHour;
        if (startPeriod === 'PM' && startHour !== 12) start24Hour += 12;
        if (startPeriod === 'AM' && startHour === 12) start24Hour = 0;

        const startTimeStr = `${String(start24Hour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
        return { duration: 60, startTime: startTimeStr };
      }
      return null;
    }
  }

  const startHour = parseInt(timeMatch[1]);
  const startMin = parseInt(timeMatch[2]);
  const startPeriod = (timeMatch[3] || 'AM').toUpperCase();

  const endHour = parseInt(timeMatch[4]);
  const endMin = parseInt(timeMatch[5]);
  const endPeriod = timeMatch[6].toUpperCase();

  // Convert to 24-hour format
  let start24Hour = startHour;
  if (startPeriod === 'PM' && startHour !== 12) start24Hour += 12;
  if (startPeriod === 'AM' && startHour === 12) start24Hour = 0;

  let end24Hour = endHour;
  if (endPeriod === 'PM' && endHour !== 12) end24Hour += 12;
  if (endPeriod === 'AM' && endHour === 12) end24Hour = 0;

  // Calculate duration in minutes
  const startTotalMin = start24Hour * 60 + startMin;
  const endTotalMin = end24Hour * 60 + endMin;

  let duration = endTotalMin - startTotalMin;
  if (duration < 0) {
    // Handle case where event spans midnight (unlikely but possible)
    duration += 24 * 60;
  }

  // Format start time as HH:MM (24-hour format)
  const startTimeStr = `${String(start24Hour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;

  return { duration, startTime: startTimeStr };
}

function parseICalDate(dateStr) {
  dateStr = dateStr.trim();
  if (dateStr.includes('T')) {
    return new Date(dateStr.replace(/Z$/, '+00:00'));
  }
  return new Date(dateStr);
}

// Parse Outlook email data from drag-and-drop
function parseOutlookEmail(text) {
  const email = {
    subject: '',
    body: '',
    sender: '',
    cc: '',
    attachments: []
  };

  const lines = text.split(/[\r\n]+/);
  let bodyStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('Subject:')) {
      email.subject = trimmed.substring(8).trim();
    } else if (trimmed.startsWith('From:')) {
      email.sender = trimmed.substring(5).trim();
    } else if (trimmed.startsWith('Cc:')) {
      email.cc = trimmed.substring(3).trim();
    } else if (trimmed.startsWith('Attachments:')) {
      const attachStr = trimmed.substring(12).trim();
      if (attachStr) {
        email.attachments = attachStr.split(/,\s*/).filter(a => a);
      }
    } else if (!line.startsWith('Subject:') && !line.startsWith('From:') &&
               !line.startsWith('Cc:') && !line.startsWith('Date:') &&
               !line.startsWith('To:') && !line.startsWith('Sent:') &&
               line.trim() && bodyStart === -1) {
      bodyStart = i;
      break;
    }
  }

  if (bodyStart >= 0) {
    email.body = lines.slice(bodyStart).join('\n').trim();
  }

  return email;
}

// Create todo from calendar event
async function createTodoFromCalendarEvent(event) {
  const data = {
    title: event.title,
    description: event.description || ''
  };

  try {
    const response = await fetch('/api/to-dos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Todo created from calendar event: ${event.title}`, 'success');
      if (typeof loadToDos === 'function') loadToDos();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating todo from calendar event:', error);
    app.notify('Error creating todo from calendar event', 'danger');
  }
}

// Create todo from email
async function createTodoFromEmail(email) {
  const description = [
    email.sender ? `From: ${email.sender}` : '',
    email.cc ? `Cc: ${email.cc}` : '',
    email.attachments.length ? `Attachments: ${email.attachments.join(', ')}` : '',
    email.body ? `\n${email.body}` : ''
  ].filter(l => l).join('\n');

  const data = {
    title: email.subject || '(No subject)',
    description: description.trim()
  };

  try {
    const response = await fetch('/api/to-dos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Todo created from email: ${email.subject}`, 'success');
      if (typeof loadToDos === 'function') loadToDos();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating todo from email:', error);
    app.notify('Error creating todo from email', 'danger');
  }
}

// Create idea from calendar event
async function createIdeaFromCalendarEvent(event) {
  const data = {
    title: event.title,
    description: event.description || ''
  };

  try {
    const response = await fetch('/api/ideas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Idea created from calendar event: ${event.title}`, 'success');
      if (typeof loadIdeas === 'function') loadIdeas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating idea from calendar event:', error);
    app.notify('Error creating idea from calendar event', 'danger');
  }
}

// Create idea from email
async function createIdeaFromEmail(email) {
  const description = [
    email.sender ? `From: ${email.sender}` : '',
    email.cc ? `Cc: ${email.cc}` : '',
    email.attachments.length ? `Attachments: ${email.attachments.join(', ')}` : '',
    email.body ? `\n${email.body}` : ''
  ].filter(l => l).join('\n');

  const data = {
    title: email.subject || '(No subject)',
    description: description.trim()
  };

  try {
    const response = await fetch('/api/ideas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Idea created from email: ${email.subject}`, 'success');
      if (typeof loadIdeas === 'function') loadIdeas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating idea from email:', error);
    app.notify('Error creating idea from email', 'danger');
  }
}

// Create template from email
async function createTemplateFromEmail(email) {
  const description = [
    email.sender ? `From: ${email.sender}` : '',
    email.cc ? `Cc: ${email.cc}` : '',
    email.attachments.length ? `Attachments: ${email.attachments.join(', ')}` : '',
    email.body ? `\n${email.body}` : ''
  ].filter(l => l).join('\n');

  const data = {
    title: email.subject || '(No subject)',
    description: description.trim(),
    status: 'In Progress'
  };

  try {
    const response = await fetch('/api/work-item-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Template created from email: ${email.subject}`, 'success');
      if (typeof loadTemplates === 'function') loadTemplates();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating template from email:', error);
    app.notify('Error creating template from email', 'danger');
  }
}

// Detect if dropped text is email
function isEmailData(text) {
  return text && (
    text.includes('Subject:') ||
    text.includes('From:') ||
    (text.includes('To:') && text.includes('Date:'))
  );
}

// Setup drag listeners for draggable items (tabs, priorities, etc.)
let currentDragType = null;
function setupDragListeners() {
  const draggables = document.querySelectorAll('[draggable="true"]:not([data-drag-bound])');
  draggables.forEach(item => {
    item.dataset.dragBound = 'true';

    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('type', item.dataset.type);
      e.dataTransfer.setData('id', item.dataset.id);
      e.dataTransfer.setData('name', item.dataset.name || item.textContent.trim());
      currentDragType = item.dataset.type;
      item.classList.add('dragging-item');
      console.log('[setupDragListeners] dragstart:', { type: item.dataset.type, id: item.dataset.id });
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging-item');
      currentDragType = null;
    });
  });
}
