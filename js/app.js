/** App entry — auth gate + wire events to store + render */

import { store } from "./state.js";
import { renderBoard, renderChrome } from "./board.js";
import { filtersFromUrl, syncUrl, syncFilterControls } from "./filters.js";
import { initDragDrop, adjacentStatus } from "./dragdrop.js";
import { announce, debounce, STATUSES } from "./utils.js";
import { exportTasks, parseImport, loadTheme, saveTheme } from "./storage.js";
import {
  getSession,
  login,
  register,
  resetPassword,
  getRecoveryQuestion,
  enterGuest,
  logout,
  sessionLabel,
  storageOwner,
} from "./auth.js";

const authScreen = document.getElementById("auth-screen");
const appEl = document.getElementById("app");
const authForm = document.getElementById("auth-form");
const authError = document.getElementById("auth-error");
const authSuccess = document.getElementById("auth-success");
const authSubmit = document.getElementById("auth-submit");
const authSubtitle = document.getElementById("auth-subtitle");
const authTabs = document.getElementById("auth-tabs");
const guestBanner = document.getElementById("guest-banner");
const guestSection = document.getElementById("guest-section");
const userBadge = document.getElementById("user-badge");
const forgotLinkWrap = document.getElementById("forgot-link-wrap");
const backToLogin = document.getElementById("back-to-login");
const passwordWrap = document.getElementById("auth-password-wrap");
const confirmWrap = document.getElementById("auth-confirm-wrap");
const questionWrap = document.getElementById("auth-question-wrap");
const answerWrap = document.getElementById("auth-answer-wrap");
const answerLabel = document.getElementById("auth-answer-label");
const recoveryQ = document.getElementById("auth-recovery-q");

const modal = document.getElementById("task-modal");
const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const titleError = document.getElementById("title-error");
const modalTitle = document.getElementById("modal-title");

let authMode = "login"; // login | register | forgot
let appReady = false;
let forgotStep = 1; // 1 = username, 2 = answer + new password

function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  saveTheme(theme);
}

function showAuthError(msg) {
  authSuccess.classList.add("hidden");
  authError.textContent = msg;
  authError.classList.remove("hidden");
}

function showAuthSuccess(msg) {
  authError.classList.add("hidden");
  authSuccess.textContent = msg;
  authSuccess.classList.remove("hidden");
}

function clearAuthError() {
  authError.textContent = "";
  authError.classList.add("hidden");
  authSuccess.textContent = "";
  authSuccess.classList.add("hidden");
}

function setAuthTab(mode) {
  authMode = mode;
  forgotStep = 1;
  clearAuthError();

  const isForgot = mode === "forgot";
  const isRegister = mode === "register";
  const isLogin = mode === "login";

  authTabs.classList.toggle("hidden", isForgot);
  guestSection.classList.toggle("hidden", isForgot);
  forgotLinkWrap.classList.toggle("hidden", !isLogin);
  backToLogin.classList.toggle("hidden", !isForgot);

  document.querySelectorAll(".auth-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === mode);
  });

  passwordWrap.classList.toggle("hidden", isForgot && forgotStep === 1);
  confirmWrap.classList.toggle("hidden", !(isRegister || (isForgot && forgotStep === 2)));
  questionWrap.classList.toggle("hidden", !isRegister);
  answerWrap.classList.toggle("hidden", !(isRegister || (isForgot && forgotStep === 2)));
  recoveryQ.classList.add("hidden");
  recoveryQ.textContent = "";

  document.getElementById("auth-password").required = !isForgot || forgotStep === 2;
  document.getElementById("auth-confirm").required = isRegister || (isForgot && forgotStep === 2);
  document.getElementById("auth-answer").required = isRegister || (isForgot && forgotStep === 2);

  if (isLogin) {
    authSubtitle.textContent = "Sign in to save your board, or try Guest mode";
    authSubmit.textContent = "Login";
    document.getElementById("auth-password").autocomplete = "current-password";
  } else if (isRegister) {
    authSubtitle.textContent = "Create an account — your board starts empty";
    authSubmit.textContent = "Create account";
    answerLabel.textContent = "Security answer";
    document.getElementById("auth-password").autocomplete = "new-password";
  } else {
    authSubtitle.textContent = "Reset password with your security answer";
    authSubmit.textContent = forgotStep === 1 ? "Continue" : "Reset password";
    answerLabel.textContent = "Your answer";
    document.getElementById("auth-password").autocomplete = "new-password";
  }
}

function showAuth() {
  authScreen.classList.remove("hidden");
  appEl.classList.add("hidden");
  guestBanner.classList.add("hidden");
  store.clearOwner();
  clearAuthError();
  authForm.reset();
  setAuthTab("login");
}

function showApp(session) {
  authScreen.classList.add("hidden");
  appEl.classList.remove("hidden");

  const label = sessionLabel(session);
  userBadge.textContent =
    session.mode === "guest" ? "Browsing as Guest" : `Signed in as ${label}`;

  guestBanner.classList.toggle("hidden", session.mode !== "guest");

  const owner = storageOwner(session);
  store.loadOwner(owner, { seedGuest: session.mode === "guest" });

  const fromUrl = filtersFromUrl();
  store.setFilters(fromUrl);
  syncFilterControls(fromUrl);

  if (!appReady) {
    bootAppEvents();
    appReady = true;
  }

  renderBoard(store);
  renderChrome(store.getSnapshot());
}

function clearError() {
  titleError.textContent = "";
  titleError.classList.add("hidden");
  titleInput.removeAttribute("aria-invalid");
}

function showError(msg) {
  titleError.textContent = msg;
  titleError.classList.remove("hidden");
  titleInput.setAttribute("aria-invalid", "true");
  titleInput.focus();
}

function openCreate(status = "todo") {
  form.reset();
  document.getElementById("task-id").value = "";
  document.getElementById("task-status").value = STATUSES.includes(status) ? status : "todo";
  document.getElementById("task-priority").value = "medium";
  modalTitle.textContent = "New Task";
  clearError();
  modal.showModal();
  titleInput.focus();
}

function openEdit(task) {
  form.reset();
  document.getElementById("task-id").value = task.id;
  titleInput.value = task.title;
  document.getElementById("task-description").value = task.description;
  document.getElementById("task-due").value = task.dueDate;
  document.getElementById("task-priority").value = task.priority;
  document.getElementById("task-status").value = task.status;
  modalTitle.textContent = "Edit Task";
  clearError();
  modal.showModal();
  titleInput.focus();
}

function bootAppEvents() {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("task-id").value.trim();
    const title = titleInput.value.trim();
    if (!title) return showError("Title is required.");

    const payload = {
      title,
      description: document.getElementById("task-description").value.trim(),
      dueDate: document.getElementById("task-due").value,
      priority: document.getElementById("task-priority").value,
      status: document.getElementById("task-status").value,
    };

    try {
      if (id) {
        store.updateTask(id, payload);
        announce(`Updated ${title}`);
      } else {
        store.createTask(payload);
        announce(`Created ${title}`);
      }
      modal.close();
    } catch (err) {
      showError(err.message || "Could not save");
    }
  });

  document.getElementById("modal-close").addEventListener("click", () => modal.close());
  document.getElementById("modal-cancel").addEventListener("click", () => modal.close());
  document.getElementById("add-task-btn").addEventListener("click", () => openCreate("todo"));
  document.getElementById("add-task-btn-mobile")?.addEventListener("click", () => openCreate("todo"));

  document.getElementById("board").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const { action, taskId, status } = btn.dataset;

    if (action === "add-in-column") return openCreate(status);

    const task = store.getTask(taskId);
    if (!task) return;

    if (action === "edit") openEdit(task);
    else if (action === "delete") {
      if (!confirm(`Delete "${task.title}"?`)) return;
      store.deleteTask(taskId);
      announce(`Deleted ${task.title}`);
    } else if (action === "move-prev" || action === "move-next") {
      const next = adjacentStatus(task.status, action === "move-prev" ? -1 : 1);
      if (next === task.status) return;
      const toIndex = store.tasks.filter((t) => t.status === next).length;
      store.moveTask(taskId, next, toIndex);
      announce(`Moved ${task.title}`);
    }
  });

  document.getElementById("board").addEventListener("keydown", (e) => {
    const card = e.target.closest?.(".task-card");
    if (!card || e.target !== card) return;
    const task = store.getTask(card.dataset.taskId);
    if (!task) return;

    if (e.key === "Enter") {
      e.preventDefault();
      openEdit(task);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (confirm(`Delete "${task.title}"?`)) {
        store.deleteTask(task.id);
        announce(`Deleted ${task.title}`);
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = adjacentStatus(task.status, e.key === "ArrowLeft" ? -1 : 1);
      if (next === task.status) return;
      store.moveTask(task.id, next, store.tasks.filter((t) => t.status === next).length);
      announce(`Moved ${task.title}`);
    }
  });

  const applySearch = debounce((value) => {
    store.setFilters({ search: value });
    syncUrl(store.filters);
  }, 160);

  document.getElementById("search-input").addEventListener("input", (e) => {
    applySearch(e.target.value);
  });

  document.getElementById("priority-filter").addEventListener("change", (e) => {
    store.setFilters({ priority: e.target.value });
    syncUrl(store.filters);
  });

  document.getElementById("status-filter").addEventListener("change", (e) => {
    store.setFilters({ status: e.target.value });
    syncUrl(store.filters);
  });

  document.getElementById("undo-btn").addEventListener("click", () => {
    const label = store.undo();
    if (label) announce(`Undid: ${label}`);
  });

  document.getElementById("theme-btn").addEventListener("click", () => {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
  });

  document.getElementById("export-btn").addEventListener("click", () => {
    exportTasks(store.tasks);
  });

  document.getElementById("import-input").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const tasks = parseImport(await file.text());
      if (!tasks.length) throw new Error("No valid tasks");
      if (!confirm(`Import ${tasks.length} tasks? Replaces current board.`)) return;
      store.replaceTasks(tasks);
      announce(`Imported ${tasks.length}`);
    } catch (err) {
      alert(err.message || "Import failed");
    } finally {
      e.target.value = "";
    }
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    logout();
    if (modal.open) modal.close();
    showAuth();
  });
  document.getElementById("logout-btn-mobile")?.addEventListener("click", () => {
    logout();
    if (modal.open) modal.close();
    showAuth();
  });

  window.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    e.preventDefault();
    const label = store.undo();
    if (label) announce(`Undid: ${label}`);
  });

  window.addEventListener("popstate", () => {
    const f = filtersFromUrl();
    store.setFilters(f);
    syncFilterControls(f);
  });

  initDragDrop(store, {
    onMoved(id) {
      const t = store.getTask(id);
      if (t) announce(`Moved ${t.title}`);
    },
  });

  store.subscribe((snap) => {
    renderBoard(store);
    renderChrome(snap);
  });
}

/* ——— Auth UI ——— */
document.getElementById("tab-login").addEventListener("click", () => setAuthTab("login"));
document.getElementById("tab-register").addEventListener("click", () => setAuthTab("register"));
document.getElementById("forgot-link").addEventListener("click", () => setAuthTab("forgot"));
backToLogin.addEventListener("click", () => setAuthTab("login"));

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAuthError();

  const username = document.getElementById("auth-username").value;
  const password = document.getElementById("auth-password").value;
  const confirm = document.getElementById("auth-confirm").value;
  const question = document.getElementById("auth-question").value;
  const answer = document.getElementById("auth-answer").value;

  authSubmit.disabled = true;
  try {
    if (authMode === "login") {
      showApp(await login(username, password));
    } else if (authMode === "register") {
      showApp(await register(username, password, confirm, question, answer));
    } else if (authMode === "forgot") {
      if (forgotStep === 1) {
        const q = getRecoveryQuestion(username);
        forgotStep = 2;
        passwordWrap.classList.remove("hidden");
        confirmWrap.classList.remove("hidden");
        answerWrap.classList.remove("hidden");
        questionWrap.classList.add("hidden");
        recoveryQ.textContent = q;
        recoveryQ.classList.remove("hidden");
        answerLabel.textContent = "Your answer";
        document.getElementById("auth-password").required = true;
        document.getElementById("auth-confirm").required = true;
        document.getElementById("auth-answer").required = true;
        document.getElementById("auth-password").value = "";
        document.getElementById("auth-confirm").value = "";
        document.getElementById("auth-answer").value = "";
        authSubmit.textContent = "Reset password";
        document.getElementById("auth-answer").focus();
      } else {
        await resetPassword(username, answer, password, confirm);
        setAuthTab("login");
        document.getElementById("auth-username").value = username;
        document.getElementById("auth-password").value = "";
        document.getElementById("auth-confirm").value = "";
        document.getElementById("auth-answer").value = "";
        showAuthSuccess("Password updated. You can login now.");
      }
    }
  } catch (err) {
    showAuthError(err.message || "Something went wrong");
  } finally {
    authSubmit.disabled = false;
  }
});

document.getElementById("guest-btn").addEventListener("click", () => {
  clearAuthError();
  showApp(enterGuest());
});

/* ——— Boot ——— */
applyTheme(loadTheme());
setAuthTab("login");

const existing = getSession();
if (existing) showApp(existing);
else showAuth();
