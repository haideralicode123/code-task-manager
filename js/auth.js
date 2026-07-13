/** Auth — register / login / forgot password / guest / session (localStorage) */

const USERS_KEY = "code-task-manager.users";
const SESSION_KEY = "code-task-manager.session";

export const SECURITY_QUESTIONS = [
  { id: "pet", label: "What was your first pet's name?" },
  { id: "city", label: "In which city were you born?" },
  { id: "school", label: "What was your primary school name?" },
  { id: "food", label: "What is your favorite food?" },
];

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeAnswer(answer) {
  return String(answer || "").trim().toLowerCase();
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function findUser(username) {
  const name = String(username || "").trim().toLowerCase();
  return loadUsers().find((u) => u.username === name) || null;
}

function validateUsername(name) {
  if (name.length < 3) throw new Error("Username must be at least 3 characters.");
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error("Use letters, numbers, and underscore only.");
}

function validatePassword(pass) {
  if (pass.length < 4) throw new Error("Password must be at least 4 characters.");
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || (s.mode !== "user" && s.mode !== "guest")) return null;
    if (s.mode === "user" && !s.username) return null;
    return s;
  } catch (_) {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export async function register(username, password, confirmPassword, securityQuestionId, securityAnswer) {
  const name = String(username || "").trim().toLowerCase();
  const pass = String(password || "");
  const confirm = String(confirmPassword || "");
  const qId = String(securityQuestionId || "");
  const answer = normalizeAnswer(securityAnswer);

  validateUsername(name);
  validatePassword(pass);
  if (pass !== confirm) throw new Error("Passwords do not match.");
  if (!SECURITY_QUESTIONS.some((q) => q.id === qId)) {
    throw new Error("Choose a security question.");
  }
  if (answer.length < 2) throw new Error("Enter a security answer (at least 2 characters).");

  const users = loadUsers();
  if (users.some((u) => u.username === name)) throw new Error("Username already taken.");

  users.push({
    username: name,
    passwordHash: await hashPassword(pass),
    securityQuestionId: qId,
    securityAnswerHash: await hashPassword(answer),
    createdAt: Date.now(),
  });
  saveUsers(users);

  const session = { mode: "user", username: name };
  saveSession(session);
  return session;
}

export async function login(username, password) {
  const name = String(username || "").trim().toLowerCase();
  const pass = String(password || "");
  if (!name || !pass) throw new Error("Enter username and password.");

  const user = findUser(name);
  if (!user) throw new Error("User not found. Create an account first.");

  const hash = await hashPassword(pass);
  if (hash !== user.passwordHash) throw new Error("Incorrect password.");

  const session = { mode: "user", username: name };
  saveSession(session);
  return session;
}

/** Look up recovery question for a username (for forgot-password UI). */
export function getRecoveryQuestion(username) {
  const user = findUser(username);
  if (!user) throw new Error("User not found.");
  if (!user.securityQuestionId || !user.securityAnswerHash) {
    throw new Error("This account has no recovery question. Sign up again.");
  }
  const q = SECURITY_QUESTIONS.find((item) => item.id === user.securityQuestionId);
  if (!q) throw new Error("Recovery question missing. Sign up again.");
  return q.label;
}

export async function resetPassword(username, securityAnswer, newPassword, confirmPassword) {
  const name = String(username || "").trim().toLowerCase();
  const answer = normalizeAnswer(securityAnswer);
  const pass = String(newPassword || "");
  const confirm = String(confirmPassword || "");

  if (!name) throw new Error("Enter your username.");
  validatePassword(pass);
  if (pass !== confirm) throw new Error("Passwords do not match.");
  if (answer.length < 2) throw new Error("Enter your security answer.");

  const users = loadUsers();
  const i = users.findIndex((u) => u.username === name);
  if (i < 0) throw new Error("User not found.");

  const user = users[i];
  if (!user.securityAnswerHash) {
    throw new Error("This account has no recovery set. Create a new account.");
  }

  const answerHash = await hashPassword(answer);
  if (answerHash !== user.securityAnswerHash) {
    throw new Error("Security answer is incorrect.");
  }

  users[i] = {
    ...user,
    passwordHash: await hashPassword(pass),
    updatedAt: Date.now(),
  };
  saveUsers(users);
  return true;
}

export function enterGuest() {
  const session = { mode: "guest", username: "guest" };
  saveSession(session);
  return session;
}

export function logout() {
  clearSession();
}

export function sessionLabel(session) {
  if (!session) return "";
  if (session.mode === "guest") return "Guest";
  return session.username;
}

export function storageOwner(session) {
  if (!session) return null;
  if (session.mode === "guest") return "guest";
  return `user:${session.username}`;
}
