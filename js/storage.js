/** localStorage persistence + theme + import/export */

import { normalizeTask } from "./utils.js";

const THEME_KEY = "code-task-manager.theme";
const LEGACY_KEY = "code task manager.v1";

function boardKey(owner) {
  return `code-task-manager.board.${owner}`;
}

export function loadState(owner) {
  if (!owner) return null;
  try {
    let raw = localStorage.getItem(boardKey(owner));
    // One-time: if no per-user data yet and legacy board exists, ignore for new users
    if (!raw && owner === "legacy") {
      raw = localStorage.getItem(LEGACY_KEY);
    }
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.tasks)) throw new Error("bad shape");
    return { tasks: data.tasks.map(normalizeTask).filter(Boolean) };
  } catch (err) {
    console.warn("storage corrupt, resetting", err);
    try {
      localStorage.removeItem(boardKey(owner));
    } catch (_) {}
    return null;
  }
}

export function saveState(owner, state) {
  if (!owner) return;
  try {
    localStorage.setItem(
      boardKey(owner),
      JSON.stringify({ tasks: state.tasks, savedAt: Date.now() })
    );
  } catch (err) {
    console.error("save failed", err);
  }
}

export function loadTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "dark" || t === "light") return t;
  } catch (_) {}
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (_) {}
}

export function exportTasks(tasks) {
  const blob = new Blob([JSON.stringify({ tasks }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `code-task-manager-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImport(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data?.tasks;
  if (!Array.isArray(list)) throw new Error("Expected a tasks array");
  return list.map(normalizeTask).filter(Boolean);
}
