import { useState } from 'react';
import WorkItem from './WorkItem';
import './Dashboard.css';

export default function Dashboard({
  items,
  currentItem,
  onClose,
  onReorder,
  onStatusChange,
}) {
  const [draggedId, setDraggedId] = useState(null);

  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropId) => {
    e.preventDefault();
    if (draggedId && draggedId !== dropId) {
      const newItems = [...items];
      const dragIndex = newItems.findIndex(i => i.id === draggedId);
      const dropIndex = newItems.findIndex(i => i.id === dropId);

      [newItems[dragIndex], newItems[dropIndex]] = [
        newItems[dropIndex],
        newItems[dragIndex],
      ];

      const orderedIds = newItems.map(i => i.id);
      onReorder(orderedIds);
    }
    setDraggedId(null);
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Today's Work</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="items-list">
        {items.map(item => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, item.id)}
            className={draggedId === item.id ? 'dragging' : ''}
          >
            <WorkItem
              item={item}
              isCurrent={currentItem?.id === item.id}
              onStatusChange={(status) => onStatusChange(item.id, status)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
