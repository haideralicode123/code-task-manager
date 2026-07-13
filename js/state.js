/**
 * App state — single source of truth.
 * UI only reads via getSnapshot / subscribe; mutations go through these methods.
 */

import { clone, createId, isPriority, isStatus, normalizeTask } from "./utils.js";
import { loadState, saveState } from "./storage.js";

const MAX_UNDO = 10;
const STATUSES_SAFE = ["todo", "in-progress", "done"];

function sampleTasks() {
  const now = Date.now();
  const samples = [
    { title: "Set up project structure", priority: "high", status: "done", order: 0 },
    { title: "Implement drag and drop", priority: "high", status: "in-progress", order: 0 },
    { title: "Wire search and URL filters", priority: "medium", status: "todo", order: 0 },
    { title: "Add undo stack", priority: "medium", status: "todo", order: 1 },
    { title: "Accessibility pass", priority: "low", status: "todo", order: 2 },
  ];
  return samples.map((s, i) =>
    normalizeTask({
      ...s,
      id: createId(),
      description: "",
      dueDate: "",
      createdAt: now - i * 1000,
      updatedAt: now - i * 1000,
    })
  );
}

function createStore() {
  let owner = null;
  let tasks = [];
  let filters = { search: "", priority: "all", status: "all" };
  let undoStack = [];
  const listeners = new Set();

  function getSnapshot() {
    return {
      tasks: tasks.slice(),
      filters: { ...filters },
      canUndo: undoStack.length > 0,
      undoLabel: undoStack.length ? undoStack[undoStack.length - 1].label : "",
      owner,
    };
  }

  function notify() {
    const snap = getSnapshot();
    listeners.forEach((fn) => fn(snap));
  }

  function persist() {
    if (!owner) return;
    saveState(owner, { tasks });
  }

  function pushUndo(entry) {
    undoStack.push(entry);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  function normalizeOrders(status) {
    tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.order - b.order)
      .forEach((t, i) => {
        t.order = i;
      });
  }

  /**
   * Load board for a logged-in user or guest.
   * - New user: empty board (no seed)
   * - Guest first visit: sample tasks so they can explore
   */
  function loadOwner(nextOwner, { seedGuest = false } = {}) {
    owner = nextOwner;
    undoStack = [];
    filters = { search: "", priority: "all", status: "all" };

    const stored = loadState(owner);
    if (stored) {
      tasks = stored.tasks;
    } else if (seedGuest) {
      tasks = sampleTasks();
      persist();
    } else {
      tasks = [];
    }
    notify();
  }

  function clearOwner() {
    owner = null;
    tasks = [];
    undoStack = [];
    notify();
  }

  function createTask(input) {
    if (!owner) throw new Error("Not signed in");
    const status = isStatus(input.status) ? input.status : "todo";
    const task = normalizeTask({
      ...input,
      id: createId(),
      order: tasks.filter((t) => t.status === status).length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    if (!task) throw new Error("Title is required");

    tasks.push(task);
    pushUndo({
      type: "create",
      label: `Create "${task.title}"`,
      revert() {
        tasks = tasks.filter((t) => t.id !== task.id);
        normalizeOrders(task.status);
        persist();
        notify();
      },
    });
    persist();
    notify();
    return task;
  }

  function updateTask(id, patch) {
    const i = tasks.findIndex((t) => t.id === id);
    if (i < 0) return null;

    const before = clone(tasks[i]);
    const next = normalizeTask({ ...tasks[i], ...patch, id, updatedAt: Date.now() });
    if (!next) throw new Error("Title is required");

    const statusChanged = before.status !== next.status;
    tasks[i] = next;

    if (statusChanged) {
      normalizeOrders(before.status);
      if (patch.order === undefined) {
        tasks[i].order = tasks.filter((t) => t.status === next.status && t.id !== id).length;
      }
      normalizeOrders(next.status);
    }

    pushUndo({
      type: "update",
      label: `Edit "${before.title}"`,
      revert() {
        const j = tasks.findIndex((t) => t.id === id);
        if (j < 0) tasks.push(before);
        else tasks[j] = before;
        normalizeOrders(before.status);
        if (statusChanged) normalizeOrders(next.status);
        persist();
        notify();
      },
    });
    persist();
    notify();
    return tasks[i];
  }

  function deleteTask(id) {
    const i = tasks.findIndex((t) => t.id === id);
    if (i < 0) return null;
    const removed = clone(tasks[i]);
    tasks.splice(i, 1);
    normalizeOrders(removed.status);

    pushUndo({
      type: "delete",
      label: `Delete "${removed.title}"`,
      revert() {
        tasks.push(removed);
        normalizeOrders(removed.status);
        persist();
        notify();
      },
    });
    persist();
    notify();
    return removed;
  }

  function moveTaskSilent(id, toStatus, toIndex) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const fromStatus = task.status;
    const fromList = tasks.filter((t) => t.status === fromStatus).sort((a, b) => a.order - b.order);
    const fromIndex = fromList.findIndex((t) => t.id === id);
    if (fromIndex < 0) return;
    fromList.splice(fromIndex, 1);

    if (fromStatus === toStatus) {
      fromList.splice(Math.max(0, Math.min(toIndex, fromList.length)), 0, task);
      fromList.forEach((t, idx) => {
        t.order = idx;
      });
    } else {
      task.status = toStatus;
      const toList = tasks.filter((t) => t.status === toStatus && t.id !== id).sort((a, b) => a.order - b.order);
      toList.splice(Math.max(0, Math.min(toIndex, toList.length)), 0, task);
      toList.forEach((t, idx) => {
        t.order = idx;
      });
      fromList.forEach((t, idx) => {
        t.order = idx;
      });
    }
    task.updatedAt = Date.now();
  }

  function moveTask(id, toStatus, toIndex) {
    if (!isStatus(toStatus)) return null;
    const task = tasks.find((t) => t.id === id);
    if (!task) return null;

    const fromStatus = task.status;
    const fromIndex = tasks
      .filter((t) => t.status === fromStatus)
      .sort((a, b) => a.order - b.order)
      .findIndex((t) => t.id === id);

    if (fromStatus === toStatus && fromIndex === toIndex) return task;

    const before = { status: fromStatus, fromIndex };
    moveTaskSilent(id, toStatus, toIndex);

    pushUndo({
      type: "move",
      label: `Move "${task.title}"`,
      revert() {
        moveTaskSilent(id, before.status, before.fromIndex);
        persist();
        notify();
      },
    });
    persist();
    notify();
    return task;
  }

  function setFilters(partial) {
    if (partial.search !== undefined) filters.search = String(partial.search);
    if (partial.priority !== undefined) {
      filters.priority =
        partial.priority === "all" || isPriority(partial.priority) ? partial.priority : "all";
    }
    if (partial.status !== undefined) {
      filters.status =
        partial.status === "all" || isStatus(partial.status) ? partial.status : "all";
    }
    notify();
  }

  function undo() {
    const entry = undoStack.pop();
    if (!entry) return false;
    entry.revert();
    notify();
    return entry.label;
  }

  function replaceTasks(next) {
    const prev = clone(tasks);
    tasks = next.map(normalizeTask).filter(Boolean);
    STATUSES_SAFE.forEach(normalizeOrders);
    pushUndo({
      type: "import",
      label: "Import",
      revert() {
        tasks = prev;
        persist();
        notify();
      },
    });
    persist();
    notify();
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function getTask(id) {
    return tasks.find((t) => t.id === id) || null;
  }

  function getVisibleTasks(f = filters) {
    const q = f.search.trim().toLowerCase();
    return tasks
      .filter((t) => {
        if (q && !t.title.toLowerCase().includes(q)) return false;
        if (f.priority !== "all" && t.priority !== f.priority) return false;
        if (f.status !== "all" && t.status !== f.status) return false;
        return true;
      })
      .sort((a, b) => a.order - b.order);
  }

  return {
    getSnapshot,
    subscribe,
    loadOwner,
    clearOwner,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    setFilters,
    undo,
    replaceTasks,
    getTask,
    getVisibleTasks,
    get filters() {
      return { ...filters };
    },
    get tasks() {
      return tasks.slice();
    },
    get owner() {
      return owner;
    },
  };
}

export const store = createStore();
