// helpers.js - small shared pieces used by the route files.

const db = require("./db");

const STATUSES = ["Open", "In Progress", "Waiting on Customer", "Resolved"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

// ---------- Small helper functions ----------

// Current time as text, e.g. "2026-10-29T10:30:00.000Z"
function now() {
  return new Date().toISOString();
}

// The time exactly 24 hours ago (used for the overdue rule)
function twentyFourHoursAgo() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

// Save one line in the history of a ticket
function addHistory(ticketId, message) {
  db.prepare("INSERT INTO activity_log (ticket_id, message, created_at) VALUES (?, ?, ?)")
    .run(ticketId, message, now());
}

// Turn an assignee id into a name for the history text
function agentName(agentId) {
  if (!agentId) {
    return "Unassigned";
  }
  const agent = db.prepare("SELECT name FROM agents WHERE id = ?").get(agentId);
  if (agent) {
    return agent.name;
  }
  return "Unknown";
}

// Overdue rule: not Resolved AND created more than 24 hours ago
function isOverdue(ticket) {
  if (ticket.status === "Resolved") {
    return false;
  }
  return ticket.created_at < twentyFourHoursAgo();
}

module.exports = { STATUSES, PRIORITIES, now, twentyFourHoursAgo, addHistory, agentName, isOverdue };
