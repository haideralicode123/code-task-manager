/** Board rendering — DOM only, no business logic */

import { PRIORITY_LABELS, STATUS_LABELS, formatDueDate } from "./utils.js";

const PRIORITY_CLASS = {
  low: "text-slate-500",
  medium: "text-amber-600",
  high: "text-rose-600",
};

export function createCard(task) {
  const li = document.createElement("li");
  li.className =
    "task-card group relative rounded-md border border-slate-200 bg-white p-3 shadow-sm outline-none hover:shadow focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-600 dark:bg-slate-800";
  li.draggable = true;
  li.dataset.taskId = task.id;
  li.tabIndex = 0;
  li.setAttribute("role", "listitem");
  li.setAttribute(
    "aria-label",
    `${task.title}. ${PRIORITY_LABELS[task.priority]}. ${STATUS_LABELS[task.status]}`
  );

  const title = document.createElement("h3");
  title.className = "pr-14 text-sm font-semibold text-slate-900 dark:text-slate-100";
  title.textContent = task.title;
  li.appendChild(title);

  if (task.description) {
    const p = document.createElement("p");
    p.className = "mt-1 line-clamp-2 text-xs text-slate-500";
    p.textContent = task.description;
    li.appendChild(p);
  }

  const meta = document.createElement("div");
  meta.className = "mt-2 flex flex-wrap gap-2 text-xs";

  if (task.dueDate) {
    const due = document.createElement("span");
    due.className = "text-slate-500";
    due.textContent = formatDueDate(task.dueDate);
    meta.appendChild(due);
  }

  const pri = document.createElement("span");
  pri.className = `font-medium ${PRIORITY_CLASS[task.priority]}`;
  pri.textContent = PRIORITY_LABELS[task.priority];
  meta.appendChild(pri);
  li.appendChild(meta);

  const actions = document.createElement("div");
  actions.className =
    "absolute right-1 top-1 flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100";

  [
    ["edit", "Edit"],
    ["move-prev", "Move left"],
    ["move-next", "Move right"],
    ["delete", "Delete"],
  ].forEach(([action, label]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:hover:bg-slate-700";
    btn.dataset.action = action;
    btn.dataset.taskId = task.id;
    btn.setAttribute("aria-label", label);
    btn.textContent = action === "edit" ? "✎" : action === "delete" ? "✕" : action === "move-prev" ? "←" : "→";
    actions.appendChild(btn);
  });

  li.appendChild(actions);
  return li;
}

function emptySlot(status) {
  const li = document.createElement("li");
  li.className =
    "flex justify-center rounded-md border border-dashed border-slate-300 py-8 dark:border-slate-600";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "text-sm text-slate-500 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded px-2";
  btn.dataset.action = "add-in-column";
  btn.dataset.status = status;
  btn.textContent = "+ Add Task";
  li.appendChild(btn);
  return li;
}

export function renderBoard(store) {
  const visible = store.getVisibleTasks();
  const byStatus = { todo: [], "in-progress": [], done: [] };
  visible.forEach((t) => byStatus[t.status]?.push(t));

  Object.keys(byStatus).forEach((status) => {
    const col = document.querySelector(`.column[data-status="${status}"]`);
    if (!col) return;
    const list = col.querySelector("[data-task-list]");
    const count = col.querySelector("[data-count]");
    const items = byStatus[status];

    if (count) {
      count.textContent = String(items.length);
      count.setAttribute("aria-label", `${items.length} tasks`);
    }

    const frag = document.createDocumentFragment();
    if (!items.length) frag.appendChild(emptySlot(status));
    else items.forEach((t) => frag.appendChild(createCard(t)));
    list.replaceChildren(frag);
  });
}

export function renderChrome(snap) {
  const undoBtn = document.getElementById("undo-btn");
  if (!undoBtn) return;
  undoBtn.disabled = !snap.canUndo;
  undoBtn.title = snap.canUndo ? `Undo: ${snap.undoLabel}` : "Nothing to undo";
}
