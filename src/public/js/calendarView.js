/**
 * Calendar View - Render entities with date fields in a month calendar grid
 * Used for any entity type that has a primary_date_field configured
 */

const CalendarView = (() => {
  let currentDate = new Date();
  let typeSlug, typeSchema, entities = [], containerElement;

  // Format date as YYYY-MM-DD
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Parse date from various formats
  function parseDate(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr + 'T00:00:00');
  }

  // Get entities for a specific date
  function getEntitiesForDate(date) {
    const dateStr = formatDate(date);
    return entities.filter(e => {
      const entityDate = e.fields?.[typeSchema.primary_date_field];
      return entityDate && formatDate(parseDate(entityDate)) === dateStr;
    });
  }

  // Render calendar grid
  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    // Create header
    const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });
    let html = `
      <div class="calendar-header d-flex justify-content-between align-items-center mb-3">
        <button class="btn btn-sm btn-outline-secondary" data-action="prev-month">
          <i class="bi bi-chevron-left"></i> Previous
        </button>
        <h5 class="mb-0">${monthName}</h5>
        <button class="btn btn-sm btn-outline-secondary" data-action="next-month">
          Next <i class="bi bi-chevron-right"></i>
        </button>
      </div>
    `;

    // Day headers
    html += `
      <div class="calendar-grid">
        <div class="calendar-header-row">
          <div class="calendar-header-cell">Sun</div>
          <div class="calendar-header-cell">Mon</div>
          <div class="calendar-header-cell">Tue</div>
          <div class="calendar-header-cell">Wed</div>
          <div class="calendar-header-cell">Thu</div>
          <div class="calendar-header-cell">Fri</div>
          <div class="calendar-header-cell">Sat</div>
        </div>
    `;

    // Day cells
    let dayCounter = 1;
    for (let week = 0; week < 6; week++) {
      html += '<div class="calendar-week">';
      for (let day = 0; day < 7; day++) {
        const cellIndex = week * 7 + day;

        if (cellIndex < startingDayOfWeek || dayCounter > daysInMonth) {
          html += '<div class="calendar-day empty"></div>';
        } else {
          const date = new Date(year, month, dayCounter);
          const dayEntities = getEntitiesForDate(date);
          const isToday = date.toDateString() === new Date().toDateString();
          const dateStr = formatDate(date);

          html += `
            <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}">
              <div class="calendar-day-header">${dayCounter}</div>
              <div class="calendar-day-entities">
          `;

          for (const entity of dayEntities.slice(0, 3)) {
            const status = entity.fields?.status || '';
            const statusClass = status === 'Complete' ? 'bg-success' : status === 'In Progress' ? 'bg-info' : 'bg-secondary';
            html += `
              <div class="calendar-entity ${statusClass}" title="${entity.title}" data-entity-id="${entity.id}">
                <span class="entity-dot"></span>
              </div>
            `;
          }

          if (dayEntities.length > 3) {
            html += `<div class="calendar-entity-more">+${dayEntities.length - 3}</div>`;
          }

          html += `
              </div>
            </div>
          `;
          dayCounter++;
        }
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // Public API
  return {
    init: async (slug, schema, container) => {
      typeSlug = slug;
      typeSchema = schema;
      containerElement = container;

      if (!typeSchema.primary_date_field) {
        container.innerHTML = `<p class="text-muted">This type doesn't have a date field configured for calendar view.</p>`;
        return;
      }

      try {
        // Fetch entities
        const response = await fetch(`/api/entities/${typeSlug}`, {
          headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
        });
        const data = await response.json();
        if (data.success) {
          entities = data.data || [];
        }

        // Render calendar
        this.render();

        // Set up event listeners
        container.addEventListener('click', (e) => {
          if (e.target.closest('[data-action="prev-month"]')) {
            currentDate.setMonth(currentDate.getMonth() - 1);
            this.render();
          }
          if (e.target.closest('[data-action="next-month"]')) {
            currentDate.setMonth(currentDate.getMonth() + 1);
            this.render();
          }
          if (e.target.closest('[data-entity-id]')) {
            const entityId = e.target.closest('[data-entity-id]').dataset.entityId;
            // Trigger entity edit (to be handled by calling code)
            window.dispatchEvent(new CustomEvent('calendar:entity-selected', { detail: { entityId, typeSlug } }));
          }
        });
      } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">Error loading calendar: ${error.message}</div>`;
      }
    },

    render: () => {
      containerElement.innerHTML = renderCalendar();
    },

    setEntities: (newEntities) => {
      entities = newEntities;
      this.render();
    }
  };
})();

// Add calendar styling
const style = document.createElement('style');
style.textContent = `
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background: #dee2e6;
    padding: 1px;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    overflow: hidden;
  }

  .calendar-header-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background: #e9ecef;
  }

  .calendar-header-cell {
    background: #6c757d;
    color: white;
    padding: 10px;
    text-align: center;
    font-weight: bold;
    font-size: 0.9em;
  }

  .calendar-week {
    display: contents;
  }

  .calendar-day {
    background: white;
    min-height: 100px;
    padding: 8px;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .calendar-day.today {
    background: #fff3cd;
    border: 2px solid #ffc107;
  }

  .calendar-day.empty {
    background: #f8f9fa;
  }

  .calendar-day-header {
    font-weight: bold;
    font-size: 0.95em;
    margin-bottom: 4px;
    color: #333;
  }

  .calendar-day-entities {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .calendar-entity {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border-radius: 3px;
    font-size: 0.75em;
    color: white;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: opacity 0.2s;
  }

  .calendar-entity:hover {
    opacity: 0.9;
  }

  .calendar-entity.bg-success { background: #28a745; }
  .calendar-entity.bg-info { background: #17a2b8; }
  .calendar-entity.bg-secondary { background: #6c757d; }

  .entity-dot {
    display: inline-block;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .calendar-entity-more {
    font-size: 0.7em;
    color: #6c757d;
    padding: 2px 4px;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .calendar-day {
      min-height: 60px;
      padding: 4px;
    }

    .calendar-day-header {
      font-size: 0.85em;
    }

    .calendar-entity {
      font-size: 0.65em;
    }
  }
`;
document.head.appendChild(style);
