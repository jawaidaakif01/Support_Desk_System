// routes/tickets.js - everything about tickets: list, create, view, update, delete, comments.
// server.js mounts this file at /api/tickets, so "/" below means /api/tickets

const express = require("express");
const db = require("../db");
const { STATUSES, PRIORITIES, now, addHistory, agentName, isOverdue } = require("../helpers");

const router = express.Router();

// ---------- list tickets with search, filters and sorting ----------
router.get("/", (req, res) => {
  let sql = `
    SELECT tickets.*, agents.name AS assignee_name
    FROM tickets
    LEFT JOIN agents ON tickets.assignee_id = agents.id
  `;

  // We collect the conditions here, then join them with AND.
  // That is how several filters work together.
  const conditions = [];
  const values = [];

  if (req.query.search) {
    conditions.push("(tickets.subject LIKE ? OR tickets.customer LIKE ?)");
    values.push("%" + req.query.search + "%");
    values.push("%" + req.query.search + "%");
  }
  if (req.query.status) {
    conditions.push("tickets.status = ?");
    values.push(req.query.status);
  }
  if (req.query.priority) {
    conditions.push("tickets.priority = ?");
    values.push(req.query.priority);
  }
  if (req.query.assignee) {
    conditions.push("tickets.assignee_id = ?");
    values.push(req.query.assignee);
  }

  if (conditions.length > 0) {
    sql = sql + " WHERE " + conditions.join(" AND ");
  }

  // Sorting. Priority needs numbers, because A-Z order would be wrong.
  if (req.query.sort === "priority") {
    sql = sql + ` ORDER BY
      CASE tickets.priority
        WHEN 'Urgent' THEN 4
        WHEN 'High' THEN 3
        WHEN 'Medium' THEN 2
        ELSE 1
      END DESC, tickets.updated_at DESC`;
  } else {
    sql = sql + " ORDER BY tickets.updated_at DESC";
  }

  const tickets = db.prepare(sql).all(values);

  // Add an "overdue" true/false to every ticket
  for (let i = 0; i < tickets.length; i++) {
    tickets[i].overdue = isOverdue(tickets[i]);
  }

  res.json(tickets);
});

// ---------- create a ticket ----------
router.post("/", (req, res) => {
  const subject = (req.body.subject || "").trim();
  const customer = (req.body.customer || "").trim();
  const description = (req.body.description || "").trim();
  const priority = req.body.priority || "Medium";
  const status = req.body.status || "Open";

  // Validation: required fields and allowed values
  if (subject === "" || customer === "" || description === "") {
    return res.status(400).json({ error: "Subject, customer and description are required." });
  }
  if (!PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: "Invalid priority." });
  }
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  const time = now();
  const result = db.prepare(`
    INSERT INTO tickets (subject, customer, description, priority, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(subject, customer, description, priority, status, time, time);

  const newId = result.lastInsertRowid;
  addHistory(newId, "Ticket created (status: " + status + ", priority: " + priority + ")");

  res.status(201).json({ id: newId });
});

// ---------- get one ticket with its comments and history ----------
router.get("/:id", (req, res) => {
  const ticket = db.prepare(`
    SELECT tickets.*, agents.name AS assignee_name
    FROM tickets
    LEFT JOIN agents ON tickets.assignee_id = agents.id
    WHERE tickets.id = ?
  `).get(req.params.id);

  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found." });
  }

  ticket.overdue = isOverdue(ticket);
  ticket.comments = db.prepare("SELECT * FROM comments WHERE ticket_id = ? ORDER BY created_at ASC, id ASC")
    .all(ticket.id);
  ticket.history = db.prepare("SELECT * FROM activity_log WHERE ticket_id = ? ORDER BY created_at ASC, id ASC")
    .all(ticket.id);

  res.json(ticket);
});

// ---------- update a ticket ----------
router.put("/:id", (req, res) => {
  const oldTicket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id);
  if (!oldTicket) {
    return res.status(404).json({ error: "Ticket not found." });
  }

  const subject = (req.body.subject || "").trim();
  const customer = (req.body.customer || "").trim();
  const description = (req.body.description || "").trim();
  const priority = req.body.priority;
  const status = req.body.status;

  // An empty assignee means "unassigned"
  let assigneeId = null;
  if (req.body.assignee_id) {
    assigneeId = Number(req.body.assignee_id);
  }

  if (subject === "" || customer === "" || description === "") {
    return res.status(400).json({ error: "Subject, customer and description are required." });
  }
  if (!PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: "Invalid priority." });
  }
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  if (assigneeId !== null) {
    const agent = db.prepare("SELECT id FROM agents WHERE id = ?").get(assigneeId);
    if (!agent) {
      return res.status(400).json({ error: "Assignee does not exist." });
    }
  }

  // Save the changes
  db.prepare(`
    UPDATE tickets
    SET subject = ?, customer = ?, description = ?, priority = ?, status = ?,
        assignee_id = ?, updated_at = ?
    WHERE id = ?
  `).run(subject, customer, description, priority, status, assigneeId, now(), oldTicket.id);

  // Write history ONLY if the value really changed (old value vs new value)
  if (oldTicket.status !== status) {
    addHistory(oldTicket.id, "Status changed from " + oldTicket.status + " to " + status);
  }
  if (oldTicket.priority !== priority) {
    addHistory(oldTicket.id, "Priority changed from " + oldTicket.priority + " to " + priority);
  }
  if (oldTicket.assignee_id !== assigneeId) {
    addHistory(oldTicket.id, "Assignee changed from " + agentName(oldTicket.assignee_id) + " to " + agentName(assigneeId));
  }

  res.json({ message: "Ticket updated." });
});

// ---------- add a public reply or an internal note ----------
router.post("/:id/comments", (req, res) => {
  const ticket = db.prepare("SELECT id FROM tickets WHERE id = ?").get(req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found." });
  }

  const type = req.body.type;
  const content = (req.body.content || "").trim();
  const author = (req.body.author || "").trim();

  if (type !== "public" && type !== "internal") {
    return res.status(400).json({ error: "Type must be public or internal." });
  }
  if (content === "") {
    return res.status(400).json({ error: "Message cannot be empty." });
  }
  if (author === "") {
    return res.status(400).json({ error: "Please choose the author." });
  }

  db.prepare("INSERT INTO comments (ticket_id, type, content, author, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(ticket.id, type, content, author, now());

  // A reply also counts as an update of the ticket
  db.prepare("UPDATE tickets SET updated_at = ? WHERE id = ?").run(now(), ticket.id);

  if (type === "public") {
    addHistory(ticket.id, author + " added a public reply");
  } else {
    addHistory(ticket.id, author + " added an internal note");
  }

  res.status(201).json({ message: "Comment added." });
});

// ---------- delete a ticket (and its comments and history) ----------
router.delete("/:id", (req, res) => {
  const ticket = db.prepare("SELECT id FROM tickets WHERE id = ?").get(req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found." });
  }

  // A transaction means: all 3 deletes succeed, or none of them do.
  // We delete the children (comments, history) first, then the ticket,
  // so no orphaned replies or history entries are left behind.
  const deleteEverything = db.transaction(() => {
    db.prepare("DELETE FROM comments WHERE ticket_id = ?").run(ticket.id);
    db.prepare("DELETE FROM activity_log WHERE ticket_id = ?").run(ticket.id);
    db.prepare("DELETE FROM tickets WHERE id = ?").run(ticket.id);
  });
  deleteEverything();

  res.json({ message: "Ticket deleted." });
});

module.exports = router;
