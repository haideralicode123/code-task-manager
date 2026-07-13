# Code Task Manager

Simple code-task-manager (Todo / In Progress / Done) with login, guest mode, and localStorage.

## How to run

Open `index.html` in the browser (or use Live Server).

## Features

- **Sign up / Login** — each user gets their own empty board
- **Forgot password** — reset with security question
- **Guest mode** — explore with sample tasks
- **Tasks** — add, edit, delete, drag & drop, undo
- **Filters** — search, priority, status
- **Theme** — light / dark
- **Import / Export** — JSON

## Files

| File | Role |
|------|------|
| `index.html` | UI (login + board) |
| `styles/custom.css` | Extra styles |
| `js/app.js` | App wiring + auth UI |
| `js/auth.js` | Login, register, guest, session |
| `js/state.js` | Tasks state + undo |
| `js/storage.js` | localStorage save/load |
| `js/board.js` | Render cards |
| `js/dragdrop.js` | Drag and drop |
| `js/filters.js` | URL filters |
| `js/utils.js` | Helpers |

## localStorage (how data is saved)

Everything stays in the browser. No server.

| Key | What it stores |
|-----|----------------|
| `code-task-manager.users` | Accounts (hashed passwords) |
| `code-task-manager.session` | Who is logged in (user / guest) |
| `code-task-manager.user:USERNAME` | That user’s tasks |
| `code-task-manager` | Guest board |
| `code-task-manager.theme` | `light` or `dark` |

### How to check it works

1. Sign up → add a task
2. Press **F12** → **Application** → **Local Storage**
3. You should see the keys above
4. Refresh the page → tasks should still be there

Console:

```js
Object.keys(localStorage)
localStorage.getItem("code-task-manager.board.user:YOUR_USERNAME")
```
