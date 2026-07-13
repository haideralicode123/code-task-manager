/** Native HTML5 drag and drop — event delegation on #board */

import { STATUSES } from "./utils.js";

export function initDragDrop(store, { onMoved } = {}) {
  const board = document.getElementById("board");
  if (!board) return;

  let draggingId = null;

  function clearHints() {
    board.querySelectorAll(".drop-indicator, .column-drag-over").forEach((el) => {
      el.classList.remove("drop-indicator", "column-drag-over");
    });
  }

  function dropIndex(list, clientY) {
    const cards = [...list.querySelectorAll(".task-card:not(.is-dragging)")];
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return cards.length;
  }

  board.addEventListener("dragstart", (e) => {
    if (e.target.closest("button, input, select, textarea")) {
      e.preventDefault();
      return;
    }
    const card = e.target.closest(".task-card");
    if (!card) return;
    draggingId = card.dataset.taskId;
    card.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggingId);
  });

  board.addEventListener("dragend", (e) => {
    e.target.closest(".task-card")?.classList.remove("is-dragging");
    draggingId = null;
    clearHints();
  });

  board.addEventListener("dragover", (e) => {
    const col = e.target.closest(".column");
    if (!col) return;
    e.preventDefault();
    clearHints();
    col.classList.add("column-drag-over");
    const card = e.target.closest(".task-card:not(.is-dragging)");
    if (card) card.classList.add("drop-indicator");
  });

  board.addEventListener("drop", (e) => {
    const col = e.target.closest(".column");
    if (!col) return;
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    const toStatus = col.dataset.status;
    if (!id || !STATUSES.includes(toStatus)) {
      clearHints();
      return;
    }
    const list = col.querySelector("[data-task-list]");
    const toIndex = list ? dropIndex(list, e.clientY) : 0;
    store.moveTask(id, toStatus, toIndex);
    onMoved?.(id, toStatus);
    clearHints();
  });
}

export function adjacentStatus(current, delta) {
  const i = STATUSES.indexOf(current);
  if (i < 0) return current;
  const next = i + delta;
  if (next < 0 || next >= STATUSES.length) return current;
  return STATUSES[next];
}
