// Shared task helpers (REC-27). Used by the Board and the task detail panel;
// REC-11's chat cards will reuse them too.

export const STATUSES = ['todo', 'in_progress', 'done']

export const STATUS_LABELS = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

// Partial update — send only the fields that changed. Returns the updated task.
export async function patchTask(id, changes) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
