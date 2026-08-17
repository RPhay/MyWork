import './WorkItem.css';

export default function WorkItem({ item, isCurrent, onStatusChange }) {
  const getPriorityColor = (priority) => {
    const colors = {
      'critical': '#ff0000',
      'high': '#ff6600',
      'medium': '#ffaa00',
      'low': '#00aa00',
    };
    return colors[priority?.toLowerCase()] || '#666';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'todo': '⭕',
      'in-progress': '🔄',
      'done': '✅',
      'blocked': '🚫',
    };
    return icons[status?.toLowerCase()] || '⭕';
  };

  return (
    <div className={`work-item ${isCurrent ? 'current' : ''}`}>
      <div className="item-drag-handle">⋮⋮</div>

      <div className="item-priority">
        <span
          className="priority-dot"
          style={{ backgroundColor: getPriorityColor(item.priority) }}
          title={item.priority}
        />
      </div>

      <div className="item-title">{item.title}</div>

      <div className="item-status">
        <button
          className="status-btn"
          onClick={() => {
            const statuses = ['todo', 'in-progress', 'done', 'blocked'];
            const currentIndex = statuses.indexOf(item.status || 'todo');
            const nextStatus = statuses[(currentIndex + 1) % statuses.length];
            onStatusChange(nextStatus);
          }}
          title="Click to cycle status"
        >
          {getStatusIcon(item.status)}
        </button>
      </div>

      {item.time_box_minutes && (
        <div className="item-timebox">{item.time_box_minutes}m</div>
      )}
    </div>
  );
}
