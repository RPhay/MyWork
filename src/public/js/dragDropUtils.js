// Shared utilities for handling email and calendar drag-and-drop

// Parse calendar events (both iCalendar and Outlook plain text formats)
function parseCalendarEvent(text) {
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
    duration: 60, // Default to 1 hour if no time can be parsed
    startTime: null
  };

  const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l);

  if (lines.length === 0) return event;

  // First line is the title
  event.title = lines[0];

  console.log('[parseOutlookPlainTextFormat] Parsed text lines:', lines);

  // Look for "When:" line and parse time (case-insensitive)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    console.log('[parseOutlookPlainTextFormat] Processing line:', line);

    const lowerLine = line.toLowerCase();

    if (lowerLine.startsWith('when:')) {
      const whenText = line.substring(line.indexOf(':') + 1).trim();
      console.log('[parseOutlookPlainTextFormat] When text:', whenText);

      // Check for all-day event indicators
      if (lowerLine.includes('all day') || whenText.toLowerCase().includes('all day')) {
        event.duration = null;
        event.startTime = null;
        console.log('[parseOutlookPlainTextFormat] All-day event detected');
      } else {
        const timeData = parseOutlookTimeRange(whenText);
        console.log('[parseOutlookPlainTextFormat] Parsed time data:', timeData);
        if (timeData !== null) {
          event.duration = timeData.duration;
          event.startTime = timeData.startTime;
        } else {
          // If we have a "When:" line but can't parse specific times, still keep default 1 hour
          console.log('[parseOutlookPlainTextFormat] Could not parse time from When line, using 60 minute default');
        }
      }
    } else if (lowerLine.startsWith('location:')) {
      const location = line.substring(line.indexOf(':') + 1).trim();
      if (location) {
        event.description = location + (event.description ? '\n' + event.description : '');
      }
    } else if (lowerLine.startsWith('organizer:') || lowerLine.startsWith('attendees:')) {
      // Skip these lines
      continue;
    } else if (lowerLine.startsWith('time:')) {
      // Some Outlook versions use "Time:" instead of "When:"
      const timeText = line.substring(line.indexOf(':') + 1).trim();
      console.log('[parseOutlookPlainTextFormat] Time text (from Time: field):', timeText);
      const timeData = parseOutlookTimeRange(timeText);
      if (timeData !== null) {
        event.duration = timeData.duration;
        event.startTime = timeData.startTime;
      }
    } else if (event.description === '' && !lowerLine.includes(':')) {
      // Treat non-field lines as description
      event.description = line;
    }
  }

  console.log('[parseOutlookPlainTextFormat] Final event:', event);

  return event;
}

function parseOutlookTimeRange(timeStr) {
  // Examples:
  // "Monday, August 3, 2026 at 12:15 PM - 12:45 PM"
  // "August 3, 2026 at 9:00 AM - 10:30 AM"
  // "Monday, August 3, 2026 2:00 PM - 3:00 PM"
  // "Monday, August 3, 2026 2:00 PM"
  // "12:15 PM - 12:45 PM"
  // "2026-08-03T14:00:00 - 2026-08-03T15:00:00" (ISO format)

  console.log('[parseOutlookTimeRange] Parsing:', timeStr);

  // Try ISO 8601 format (2026-08-03T14:00:00 - 2026-08-03T15:00:00)
  const isoMatch = timeStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\s*-\s*(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (isoMatch) {
    const startHour = parseInt(isoMatch[4]);
    const startMin = parseInt(isoMatch[5]);
    const endHour = parseInt(isoMatch[10]);
    const endMin = parseInt(isoMatch[11]);
    const duration = (endHour - startHour) * 60 + (endMin - startMin);
    const startTimeStr = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
    return { duration: Math.max(duration, 0) || 60, startTime: startTimeStr };
  }

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
        console.log('[parseOutlookTimeRange] Single time found, returning 60 min default');
        return { duration: 60, startTime: startTimeStr };
      }
      console.log('[parseOutlookTimeRange] No time pattern matched');
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

  console.log('[parseOutlookTimeRange] Calculated duration:', duration, 'startTime:', startTimeStr);

  return { duration: Math.max(duration, 0) || 60, startTime: startTimeStr };
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
    const response = await app.fetchRaw('/api/to-dos', {
      method: 'POST',
      
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Todo created from calendar event: ${event.title}`, 'success');
      window.GenericEntityTabs?.refresh('to_do');
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
    const response = await app.fetchRaw('/api/to-dos', {
      method: 'POST',
      
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Todo created from email: ${email.subject}`, 'success');
      window.GenericEntityTabs?.refresh('to_do');
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
    const response = await app.fetchRaw('/api/ideas', {
      method: 'POST',
      
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Idea created from calendar event: ${event.title}`, 'success');
      window.GenericEntityTabs?.refresh('idea');
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating idea from calendar event:', error);
    app.notify('Error creating idea from calendar event', 'danger');
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
    const response = await app.fetchRaw('/api/daily-templates', {
      method: 'POST',
      
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Template created from email: ${email.subject}`, 'success');
      window.GenericEntityTabs?.refresh('template');
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

// ===========================================================================
// The drag protocol
// ===========================================================================
//
// Every drag in this app goes through these three helpers. They exist because
// the same Chromium rule was rediscovered and fixed locally three separate
// times (templates.js, priority-board.js, generic-entity-init.js), each with
// its own comment:
//
//   A drag is REFUSED SILENTLY when the source's effectAllowed and the
//   target's dropEffect do not overlap. A source that says 'move' and a target
//   that asks for 'copy' produces no drop, no error and no console warning -
//   the drop simply never fires.
//
// Nine sources still said plain 'move' while several targets asked for 'copy',
// so that failure was one pairing away at any time. The fix is not to remember
// the rule: it is to stop hand-writing the protocol.
//
// beginDrag() always offers 'copyMove', which overlaps whatever a target asks
// for. Deciding move-vs-copy is the TARGET's job - it is the one that knows
// whether the drop reorders a row or references it somewhere else.

// ===== Where a drop lands =====
//
// Finding 05 asks for the drop-zone calculation to live here with the rest of
// the drag protocol, so a surface supplies a callback rather than its own copy
// of the geometry. These were on `app` in main.js, beside unrelated helpers.
//
// Two shapes, because there are two kinds of list:
//   - a FLAT list: above the midpoint is before, below is after
//   - a TREE: the middle band means "inside", so a row can be nested by
//     aiming at it rather than needing a separate gesture
//
// The tree bands are 25/50/25. A narrower nest band makes nesting fiddly; a
// wider one makes reordering fiddly, and reordering is the commoner action.
function dropZoneFlat(event, rowEl) {
  const rect = rowEl.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}

function dropZoneTree(event, rowEl) {
  const rect = rowEl.getBoundingClientRect();
  const offset = (event.clientY - rect.top) / rect.height;
  if (offset < 0.25) return 'before';
  if (offset > 0.75) return 'after';
  return 'nest';
}

// A third shape: a HORIZONTAL strip, which is the column header row. Same
// midpoint rule as dropZoneFlat, on the other axis.
//
// This one was left behind when the geometry moved here in finding 05: the
// vertical and tree helpers became delegates on `app`, the horizontal one was
// deleted outright, and generic-entity-init.js went on calling
// app.getHorizontalDropZone in both its column dragover and drop handlers. That
// threw TypeError on every column drag, so reordering columns did nothing at
// all - silently, because a throw inside a listener does not surface.
function dropZoneHorizontal(event, cellEl) {
  const rect = cellEl.getBoundingClientRect();
  return event.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
}

// One entry point: `nesting` says which shape this list is, so callers hold a
// flag rather than knowing the geometry.
function dropZone(event, rowEl, { nesting = false } = {}) {
  return nesting ? dropZoneTree(event, rowEl) : dropZoneFlat(event, rowEl);
}

// Paint the indicator that goes with a zone, so "work out where it lands" and
// "show where it lands" cannot disagree - they were separate steps at every
// call site, and a surface that updated one without the other showed a lie.
function showDropZone(rowEl, zone, { nestClass = 'entity-drop-target-nest' } = {}) {
  clearDropIndicators(rowEl);
  rowEl.classList.remove(nestClass);
  if (zone === 'nest') rowEl.classList.add(nestClass);
  else showDropIndicator(rowEl, zone);
  return zone;
}

const DRAG_EFFECT_ALLOWED = 'copyMove';

// Call in dragstart. `data` is a plain object of dataTransfer entries.
function beginDrag(event, data = {}) {
  event.dataTransfer.effectAllowed = DRAG_EFFECT_ALLOWED;
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    event.dataTransfer.setData(key, String(value));
  }
}

// Call in dragover/dragenter on a target that will accept the drop. Without the
// preventDefault the browser refuses the drop, which is the other half of the
// same silent failure.
function acceptDrop(event, effect = 'move') {
  event.preventDefault();
  event.dataTransfer.dropEffect = effect;
}

// A drag from OUTSIDE this app - a ServiceNow record dragged straight out of
// its own browser tab, say - never carries the internal 'type' key beginDrag()
// sets above. There is no session on THIS server to authenticate with
// whatever sent it, so accepting one means reading only what the browser's
// own drag already carries: a URL, and its link text.
//
// dragover/dragenter can only see dataTransfer's type NAMES, never the actual
// values - browsers withhold those from getData() until the drop event
// itself fires, the same restriction that stops a page reading your
// clipboard just by you hovering over it. Measured against a real
// ServiceNow tab in Chrome: the only types present were 'text/plain' and a
// Chromium-internal 'chromium/x-drag-id' marker - no 'text/uri-list', no
// 'text/html'. Both of those are accepted when present because they mean
// "a link was dragged" more reliably, but 'text/plain' alone has to be
// accepted too or nothing this common actually works - it just means MAYBE,
// resolved for real at drop time by trying to find a URL in it.
function looksLikeExternalLinkDrag(dataTransfer) {
  const types = dataTransfer?.types || [];
  return types.includes('text/uri-list') || types.includes('text/html') || types.includes('text/plain');
}

// Only meaningful from a 'drop' handler, where getData() actually returns
// values - call this synchronously, before any await, for the same reason
// dailies-list-events.js's calendar-drop reader does. Prefers the URL list,
// then an anchor's href out of the dragged HTML, then plain text if it is
// itself URL-shaped - covering a plain link drag, a rich-text link drag, and
// a bare URL typed or selected as text.
//
// A URL is NOT required: a real ServiceNow drag, measured in Chrome, carried
// only 'text/plain' with no 'text/uri-list' or 'text/html' at all - whatever
// that plain text turns out to be (the record number with no link, say) is
// still worth creating a record from, rather than silently discarding a drag
// that plainly carried something. Only returns null when there is truly
// nothing readable at all, which callers should treat as "not for us" rather
// than an error - this can fire on an ordinary empty or unreadable drag.
function externalLinkDropPayload(dataTransfer) {
  const uriList = dataTransfer.getData('text/uri-list')?.trim();
  const plain = dataTransfer.getData('text/plain')?.trim();
  const html = dataTransfer.getData('text/html');
  let url = uriList || (/^https?:\/\//i.test(plain || '') ? plain : null);
  if (!url && html) {
    const match = html.match(/href=["']([^"']+)["']/i);
    if (match) url = match[1];
  }
  let title = plain && plain !== url ? plain : null;
  if (!title && html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    title = wrapper.textContent.trim();
  }
  if (!url && !title) return null;
  return { url, title: (title || url).slice(0, 200) };
}

// Shared by every page that can receive an external link drop, so a
// ServiceNow record is created identically everywhere. Returns the created
// entity, or null (having already notified) on failure - "attaching" it
// somewhere (a hierarchy relationship here, linkChild/putEntityOnDay on
// Dailies) is page-specific and left to the caller.
async function createServiceNowRecord(payload) {
  try {
    const response = await app.fetchRaw('/api/entities/servicenow', {
      method: 'POST',
      body: JSON.stringify(
        payload.url ? { title: payload.title, fields: { url: payload.url } } : { title: payload.title }
      ),
    });
    const result = await response.json();
    if (!result.success) {
      app.notify(result.message || 'Could not create it', 'danger');
      return null;
    }
    return result.data;
  } catch (error) {
    app.notify(error.message || 'Could not create that', 'danger');
    return null;
  }
}

// Opens one field of one entity as a real, always-on-top OS window (the
// desktop wrapper's `sticky` mode - see pipWindowService.js and main.rs).
// Shared here, not local to either caller, because BOTH a generic tab
// (generic-entity-init.js) and Dailies (dailies-list-events.js, which is not
// a generic tab and shares no state with one) need to trigger the exact same
// launch for the exact same data-action="pop-sticky" glyph
// (genericEntity.js#renderCellValue renders it identically everywhere a
// 'stickies' field's cell appears). A sticky note is not a modal - the page
// only asks the server to spawn the window; /sticky itself owns the text,
// the autosave, and its own close.
async function popStickyNote(entityId, typeSlug, fieldKey, e) {
  try {
    const res = await app.fetchRaw('/api/pip-window/sticky', {
      method: 'POST',
      body: JSON.stringify({
        id: entityId,
        type: typeSlug,
        field: fieldKey,
        x: Math.round(window.screenX + (e?.clientX || 0)),
        y: Math.round(window.screenY + Math.max(0, window.outerHeight - window.innerHeight) + (e?.clientY || 0)),
      }),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.message);
    if (result.data?.alreadyOpen) app.notify('Already open - look for the window', 'info');
  } catch (error) {
    app.notify(error.message || 'Could not open that sticky note', 'danger');
  }
}

// ---------------------------------------------------------------------------
// Drop indicators
//
// The before/after insertion lines were reimplemented in four files (26 places)
// with the same two class names. One implementation, so a change to how a drop
// target looks happens once.
// ---------------------------------------------------------------------------

const DROP_INDICATOR_CLASSES = ['drop-indicator-before', 'drop-indicator-after'];

function showDropIndicator(element, position) {
  if (!element) return;
  element.classList.remove(...DROP_INDICATOR_CLASSES);
  element.classList.add(position === 'before' ? 'drop-indicator-before' : 'drop-indicator-after');
}

function clearDropIndicators(root = document) {
  root.querySelectorAll('.drop-indicator-before, .drop-indicator-after')
    .forEach(el => el.classList.remove(...DROP_INDICATOR_CLASSES));
}

// Setup drag listeners for draggable items (tabs, priorities, etc.)
let currentDragType = null;
function setupDragListeners() {
  const draggables = document.querySelectorAll('[draggable="true"]:not([data-drag-bound])');
  draggables.forEach(item => {
    item.dataset.dragBound = 'true';

    item.addEventListener('dragstart', (e) => {
      beginDrag(e, {
        type: item.dataset.type,
        id: item.dataset.id,
        name: item.dataset.name || item.textContent.trim(),
      });
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

// A file dropped anywhere OTHER than a drop zone navigates the tab to it.
// That was harmless while nothing here accepted files; the Dailies rail does
// now, so a drag that lands a few pixels short of the rail would replace the
// app with a rendering of the .ics and take any open editor's unsaved state
// with it. Both listeners are needed: dragover decides whether a drop is
// allowed at all, drop decides whether the browser handles it.
//
// defaultPrevented means a real drop zone already claimed the event - bubble
// phase, so its handler has run - and this leaves it alone.
(function guardStrayFileDrops() {
  const carriesFiles = (dt) => Array.from(dt?.types || []).includes('Files');

  document.addEventListener('dragover', (e) => {
    if (carriesFiles(e.dataTransfer)) e.preventDefault();
  });

  document.addEventListener('drop', (e) => {
    if (e.defaultPrevented || !carriesFiles(e.dataTransfer)) return;
    e.preventDefault();
    console.warn('[dragDropUtils] file drop outside a drop zone, ignored:',
      Array.from(e.dataTransfer.files || []).map((f) => f.name));
  });
})();
