// db.js - creates the database file and the 4 tables.
// Other files use it by writing: const db = require("./db");

const Database = require("better-sqlite3");

// This creates (or opens) a file called supportdesk.db in the project folder.
// Because it is a file, our data stays saved after we restart the app.
// Tests use a different file (set with DB_FILE) so your real data is never touched.
const db = new Database(process.env.DB_FILE || "supportdesk.db");

// Make SQLite enforce the links between tables (foreign keys).
db.pragma("foreign_keys = ON");

// Table 1: agents (the support team members)
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )
`);

// Table 2: tickets
// assignee_id links to agents.id (it can be empty = not assigned yet)
db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    subject     TEXT NOT NULL,
    customer    TEXT NOT NULL,
    description TEXT NOT NULL,
    priority    TEXT NOT NULL DEFAULT 'Medium',
    status      TEXT NOT NULL DEFAULT 'Open',
    assignee_id INTEGER,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    FOREIGN KEY (assignee_id) REFERENCES agents(id)
  )
`);

// Table 3: comments (public replies and internal notes)
// type is either 'public' or 'internal'
db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id  INTEGER NOT NULL,
    type       TEXT NOT NULL,
    content    TEXT NOT NULL,
    author     TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
  )
`);

// Table 4: activity_log (history of important events)
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id  INTEGER NOT NULL,
    message    TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
  )
`);

// Indexes make searches faster (like the index at the back of a book).
// We add them on the columns we filter or look up by most often.
// The trade-off: they use a little extra space and make writes slightly slower.
db.exec("CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)");
db.exec("CREATE INDEX IF NOT EXISTS idx_comments_ticket ON comments(ticket_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_history_ticket ON activity_log(ticket_id)");

// Add 3 demo agents, but only if the agents table is empty.
const agentCount = db.prepare("SELECT COUNT(*) AS total FROM agents").get().total;
if (agentCount === 0) {
  const insertAgent = db.prepare("INSERT INTO agents (name) VALUES (?)");
  insertAgent.run("Asha");
  insertAgent.run("Ravi");
  insertAgent.run("Meera");
}

module.exports = db;
