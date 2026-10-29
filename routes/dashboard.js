// routes/dashboard.js - dashboard numbers (mounted at /api/dashboard)

const express = require("express");
const db = require("../db");
const { twentyFourHoursAgo } = require("../helpers");

const router = express.Router();

// ---------- dashboard numbers (counted from the real data) ----------
router.get("/", (req, res) => {
  const total = db.prepare("SELECT COUNT(*) AS n FROM tickets").get().n;
  const open = db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE status = 'Open'").get().n;
  const inProgress = db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE status = 'In Progress'").get().n;
  const resolved = db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE status = 'Resolved'").get().n;

  // Urgent tickets that are still not resolved
  const urgent = db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE priority = 'Urgent' AND status != 'Resolved'").get().n;

  // Overdue: not resolved and created more than 24 hours ago
  const overdue = db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE status != 'Resolved' AND created_at < ?")
    .get(twentyFourHoursAgo()).n;

  res.json({ total, open, inProgress, resolved, urgent, overdue });
});

module.exports = router;
