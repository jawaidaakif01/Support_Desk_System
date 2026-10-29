// routes/agents.js - list of support agents (mounted at /api/agents)

const express = require("express");
const db = require("../db");

const router = express.Router();

// ---------- list of agents (for the dropdowns) ----------
router.get("/", (req, res) => {
  const agents = db.prepare("SELECT * FROM agents").all();
  res.json(agents);
});

module.exports = router;
