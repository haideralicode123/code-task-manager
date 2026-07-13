/** Filters + URL query sync (?search=&priority=&status=) */

import { isPriority, isStatus } from "./utils.js";

export function filtersFromUrl() {
  const p = new URLSearchParams(location.search);
  const priority = (p.get("priority") || "all").toLowerCase();
  const status = (p.get("status") || "all").toLowerCase();
  return {
    search: p.get("search") || "",
    priority: priority === "all" || isPriority(priority) ? priority : "all",
    status: status === "all" || isStatus(status) ? status : "all",
  };
}

export function syncUrl(filters) {
  const p = new URLSearchParams();
  if (filters.search.trim()) p.set("search", filters.search.trim());
  if (filters.priority !== "all") p.set("priority", filters.priority);
  if (filters.status !== "all") p.set("status", filters.status);
  const qs = p.toString();
  const next = qs ? `${location.pathname}?${qs}` : location.pathname;
  const cur = `${location.pathname}${location.search}`;
  if (next !== cur) history.replaceState(null, "", next);
}

export function syncFilterControls(filters) {
  const search = document.getElementById("search-input");
  const priority = document.getElementById("priority-filter");
  const status = document.getElementById("status-filter");
  if (search && search.value !== filters.search) search.value = filters.search;
  if (priority) priority.value = filters.priority;
  if (status) status.value = filters.status;
}
