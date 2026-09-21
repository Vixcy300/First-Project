import React, { useState } from 'react';
import { type Task } from '../api';
import { getDueDateBadge } from './TaskDetailModal';

interface KanbanBoardProps {
  tasks: Task[];
  onStatusChange: (taskId: number, newStatus: string) => Promise<void>;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: number) => void;
  onOpenDetails: (task: Task) => void;
}

const COLUMNS = [
  { id: 'To Do', label: 'To Do', color: 'var(--text-soft)', icon: '📝' },
  { id: 'In Progress', label: 'In Progress', color: 'var(--primary)', icon: '⚡' },
  { id: 'Done', label: 'Done', color: 'var(--success)', icon: '✅' },
];

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onStatusChange,
  onEditTask,
  onDeleteTask,
  onOpenDetails,
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', String(taskId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = (_e: React.DragEvent) => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskIdStr = e.dataTransfer.getData('text/plain');
    const taskId = Number(taskIdStr) || draggedTaskId;

    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== targetStatus) {
      await onStatusChange(taskId, targetStatus);
    }
    setDraggedTaskId(null);
  };

  return (
    <div className="kanban-board">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.id);

        return (
          <div
            key={col.id}
            className={`kanban-column ${dragOverColumn === col.id ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column Header */}
            <div className="kanban-column-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{col.icon}</span>
                <span className="kanban-column-title">{col.label}</span>
              </div>
              <span className="kanban-task-count">{colTasks.length}</span>
            </div>

            {/* Column Task Cards */}
            <div className="kanban-cards-container">
              {colTasks.map(task => {
                const dueBadge = getDueDateBadge(task.due_date);
                const priority = task.priority || 'Medium';

                return (
                  <div
                    key={task.id}
                    className={`kanban-card ${draggedTaskId === task.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={() => setDraggedTaskId(null)}
                  >
                    {/* Top Badges */}
                    <div className="kanban-card-top">
                      <span className={`priority-badge priority-${priority.toLowerCase()}`}>
                        {priority}
                      </span>
                      {dueBadge && (
                        <span className={`due-badge ${dueBadge.className}`} style={{ fontSize: '0.72rem' }}>
                          {dueBadge.text}
                        </span>
                      )}
                    </div>

                    {/* Task Title */}
                    <h4 
                      className="kanban-card-title" 
                      onClick={() => onOpenDetails(task)}
                      title="Click to view discussion & activity history"
                    >
                      {task.title}
                    </h4>

                    {/* Description preview */}
                    {task.description && (
                      <p className="kanban-card-desc">
                        {task.description.length > 80
                          ? `${task.description.substring(0, 80)}...`
                          : task.description}
                      </p>
                    )}

                    {/* Footer Info */}
                    <div className="kanban-card-footer">
                      <span className="kanban-assignee">
                        👤 {task.assignee ? task.assignee.name : (task.assigned_user_id ? `User #${task.assigned_user_id}` : 'Unassigned')}
                      </span>
                      
                      <div className="kanban-card-actions">
                        <button
                          className="btn-icon"
                          onClick={() => onOpenDetails(task)}
                          title="Open Comments & History"
                        >
                          💬
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => onEditTask(task)}
                          title="Edit Task"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => onDeleteTask(task.id)}
                          title="Delete Task"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {colTasks.length === 0 && (
                <div className="kanban-empty-dropzone">
                  Drag tasks here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;

