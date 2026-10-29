# Support Desk System

A small web app where a support team can create tickets, assign them, reply to customers,
add internal notes, and see a dashboard.

## Tech used
- **Backend:** Node.js + Express (REST API)
- **Database:** SQLite (a single file, `supportdesk.db`, created automatically)
- **Frontend:** plain HTML, CSS and JavaScript (no framework)

## How to run
1. Install Node.js (version 18 or higher).
2. Open a terminal in this folder and run:
   ```
   npm install
   npm start
   ```
3. Open http://localhost:3000 in the browser.

No environment variables are needed. The database file and tables are created
automatically the first time the app starts (see `db.js`). Three demo agents
(Asha, Ravi, Meera) are added automatically. There is no login.

## Run the tests
```
npm test
```
This starts the app with a temporary database and checks the main business rules
(validation, history only on real changes, overdue, resolved, 404, delete).

## Project files
| File | Purpose |
|---|---|
| `db.js` | Creates the database and the 4 tables |
| `server.js` | Starts the app and connects the route files |
| `helpers.js` | Small shared functions (time, history, overdue rule, allowed values) |
| `routes/tickets.js` | Ticket routes: list, create, view, update, delete, comments |
| `routes/agents.js` | Agents list |
| `routes/dashboard.js` | Dashboard counts |
| `public/index.html` | The page layout (list, create form, ticket detail) |
| `public/app.js` | Frontend logic (calls the API and shows the data) |
| `public/style.css` | Styling |
| `test.js` | Automated checks of the business rules (`npm test`) |
| `prompts.md` | The AI prompts I used and what I checked |

## Database tables
- `agents` (id, name)
- `tickets` (id, subject, customer, description, priority, status, assignee_id, created_at, updated_at)
- `comments` (id, ticket_id, type = public/internal, content, author, created_at)
- `activity_log` (id, ticket_id, message, created_at)

## API endpoints
| Method | URL | What it does |
|---|---|---|
| GET | `/api/agents` | List agents |
| GET | `/api/tickets` | List tickets (`?search=&status=&priority=&assignee=&sort=updated\|priority`) |
| POST | `/api/tickets` | Create a ticket |
| GET | `/api/tickets/:id` | One ticket with comments and history |
| PUT | `/api/tickets/:id` | Update a ticket |
| DELETE | `/api/tickets/:id` | Delete a ticket with its comments and history |
| POST | `/api/tickets/:id/comments` | Add a public reply or internal note |
| GET | `/api/dashboard` | Dashboard counts |

Errors return JSON like `{ "error": "message" }` with status 400 (invalid input) or 404 (not found).

## Key decisions and assumptions
- **Overdue** is calculated when data is read (not stored): status is not Resolved AND created more than 24 hours ago. A stored flag could become out of date.
- **Resolved** tickets are not counted as open, in progress, overdue or urgent.
- "Urgent" on the dashboard means urgent priority and not resolved.
- **History** is written only when status, priority or assignee really changes.
- **Deleting a ticket also deletes its replies, notes and history** inside one database transaction, so nothing is left orphaned.
- **Indexes** on `tickets.status`, `comments.ticket_id` and `activity_log.ticket_id` speed up filtering and loading a ticket's comments and history.
- **Safety:** SQL queries use `?` placeholders (prevents SQL injection) and user text is escaped before showing it (prevents XSS).
- The author of a reply is chosen from the agent dropdown (no login).

## What works
All core requirements: ticket create/list/detail/edit, statuses and priorities, assignment,
public replies and internal notes, search, combined filters, sorting, activity history,
dashboard, validation on client and server, persistence after restart.

## Known issues / not done
- No login or roles and no pagination (stretch goals not attempted). Tests cover the main business rules only, not the UI.
- The list is not paginated, so it may be slow with thousands of tickets.
- The detail page reloads fully after each save.

## How AI was used

I used Claude (the chat version) to build this project. I gave it the task PDF and told it what I wanted: the simplest code possible, very few files, no extra frameworks, and code that a beginner can read and explain. It suggested the stack (Node, Express, SQLite and plain HTML/JS) and the 4 tables, and then wrote the first version of the code.

After that I ran the app on my laptop and tried it myself: creating tickets, adding public replies and internal notes, changing status and priority, search, filters, and the dashboard.

Some things I asked it to change after the first version:
- The first version had no delete. When I saw the instruction said CRUD app, I asked for delete to be added. It deletes the ticket together with its comments and history in one transaction, so nothing is left behind.
- All the routes were in one big server.js file. I asked to split them into separate files but keep it simple, so now there is a routes folder and a helpers.js file.
- I also asked for indexes, a small test file (npm test) and a fix so the table scrolls on small screens.

I kept it in plain JavaScript and SQLite on purpose because of the 3 hour limit and because I wanted code I can fully explain. AI code can be wrong, so I tested the main flows myself instead of just trusting it.
