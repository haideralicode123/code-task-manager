/** Shared helpers */

export const STATUSES = ["todo", "in-progress", "done"];
export const PRIORITIES = ["low", "medium", "high"];

export const STATUS_LABELS = {
  todo: "Todo",
  "in-progress": "In Progress",
  done: "Done",
};

export const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function createId() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function debounce(fn, wait = 150) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export function formatDueDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function isStatus(v) {
  return STATUSES.includes(v);
}

export function isPriority(v) {
  return PRIORITIES.includes(v);
}

export function normalizeTask(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return null;
  const now = Date.now();
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    title: title.slice(0, 120),
    description: typeof raw.description === "string" ? raw.description.slice(0, 1000) : "",
    dueDate: typeof raw.dueDate === "string" ? raw.dueDate : "",
    priority: isPriority(raw.priority) ? raw.priority : "medium",
    status: isStatus(raw.status) ? raw.status : "todo",
    order: typeof raw.order === "number" ? raw.order : 0,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
  };
}

export function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

export function announce(msg) {
  const el = document.getElementById("live-region");
  if (!el) return;
  el.textContent = "";
  requestAnimationFrame(() => {
    el.textContent = msg;
  });
}
