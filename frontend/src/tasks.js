// Shared task helpers (REC-27, steps in REC-30). Used by the Board and the
// task detail modal; REC-11's chat cards will reuse them too.

export const STATUSES = ['todo', 'in_progress', 'done']

export const STATUS_LABELS = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

// Forward moves (todo → in_progress → done) get a celebration; backward don't.
export const STATUS_ORDER = { todo: 0, in_progress: 1, done: 2 }

// --- Steps ---------------------------------------------------------------

// The current step is the first one not done; -1 when every step is done.
export function currentStepIndex(task) {
  return task.steps.findIndex((s) => !s.done_at)
}

export function doneStepCount(task) {
  return task.steps.filter((s) => s.done_at).length
}

// The naming rule (Nitin, REC-30): the current step's position decides it.
export function actionLabel(task, i = currentStepIndex(task)) {
  if (i < 0) return null
  if (i === 0) return 'First action'
  if (i === task.steps.length - 1) return 'Last action'
  return 'Next action'
}

// "Thu 4:12 PM" for a finished step.
export function formatDoneAt(iso) {
  // The API sends naive UTC timestamps; mark them as UTC before parsing.
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
  const mins = (Date.now() - d.getTime()) / 60000
  if (mins < 1) return 'just now'
  return d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

// --- API -----------------------------------------------------------------

async function send(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Partial update — send only the fields that changed. Returns the updated task.
export function patchTask(id, changes) {
  return send('PATCH', `/api/tasks/${id}`, changes)
}

// Completing a step on a To do task also moves it to In progress (server side).
export function completeStep(taskId, stepId) {
  return send('POST', `/api/tasks/${taskId}/steps/${stepId}/complete`)
}

export function undoStep(taskId, stepId) {
  return send('POST', `/api/tasks/${taskId}/steps/${stepId}/undo`)
}

// The step editor's Save: open steps in order, [{ id?, text }]. Finished
// steps are locked server side.
export function replaceSteps(taskId, steps) {
  return send('PUT', `/api/tasks/${taskId}/steps`, { steps })
}
