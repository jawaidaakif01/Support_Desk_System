// test.js - checks the most important business rules.
// Run it with:  npm test
// It uses its own temporary database (test.db), so your real data is safe.

const fs = require("fs");
process.env.DB_FILE = "test.db";
process.env.PORT = "3001";
if (fs.existsSync("test.db")) {
  fs.unlinkSync("test.db");
}

const db = require("./db");   // the test database
require("./server");          // starts the server on port 3001

const BASE = "http://localhost:3001";
let passed = 0;
let failed = 0;

// Print PASS or FAIL for one check
function check(name, condition) {
  if (condition) {
    console.log("PASS - " + name);
    passed++;
  } else {
    console.log("FAIL - " + name);
    failed++;
  }
}

// Small helper to call our own API
async function api(url, method, body) {
  const options = { method: method, headers: { "Content-Type": "application/json" } };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(BASE + url, options);
  const data = await response.json();
  return { status: response.status, data: data };
}

async function runTests() {
  // 1. Validation: missing subject must be rejected
  let r = await api("/api/tickets", "POST", { subject: "", customer: "a@b.com", description: "x" });
  check("Create ticket without subject returns 400", r.status === 400);

  // 2. Create a valid ticket
  r = await api("/api/tickets", "POST", {
    subject: "Login broken", customer: "a@b.com", description: "Cannot login", priority: "Urgent"
  });
  check("Create valid ticket returns 201", r.status === 201);
  const id = r.data.id;

  // 3. Creation must write one history entry
  r = await api("/api/tickets/" + id, "GET");
  check("New ticket has 1 history entry", r.data.history.length === 1);

  // 4. Saving with NO changes must not add history
  const same = {
    subject: "Login broken", customer: "a@b.com", description: "Cannot login",
    priority: "Urgent", status: "Open", assignee_id: ""
  };
  await api("/api/tickets/" + id, "PUT", same);
  r = await api("/api/tickets/" + id, "GET");
  check("Saving without changes adds no history", r.data.history.length === 1);

  // 5. Changing status must add history
  same.status = "In Progress";
  await api("/api/tickets/" + id, "PUT", same);
  r = await api("/api/tickets/" + id, "GET");
  check("Status change adds a history entry", r.data.history.length === 2);

  // 6. Invalid status must be rejected
  same.status = "Banana";
  r = await api("/api/tickets/" + id, "PUT", same);
  check("Invalid status returns 400", r.status === 400);
  same.status = "In Progress";

  // 7. Comments: bad type rejected, internal note saved
  r = await api("/api/tickets/" + id + "/comments", "POST", { type: "bad", content: "x", author: "Asha" });
  check("Comment with bad type returns 400", r.status === 400);
  r = await api("/api/tickets/" + id + "/comments", "POST", { type: "internal", content: "Check logs", author: "Asha" });
  check("Internal note returns 201", r.status === 201);
  r = await api("/api/tickets/" + id, "GET");
  check("Ticket now has 1 comment of type internal", r.data.comments.length === 1 && r.data.comments[0].type === "internal");

  // 8. Overdue rule: make the ticket 30 hours old
  const oldTime = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
  db.prepare("UPDATE tickets SET created_at = ? WHERE id = ?").run(oldTime, id);
  r = await api("/api/dashboard", "GET");
  check("Old unresolved ticket counts as overdue", r.data.overdue === 1);

  // 9. Resolved tickets are not overdue and not in progress
  same.status = "Resolved";
  await api("/api/tickets/" + id, "PUT", same);
  r = await api("/api/dashboard", "GET");
  check("Resolved ticket is not overdue", r.data.overdue === 0);
  check("Resolved ticket is not in progress", r.data.inProgress === 0);

  // 10. Missing ticket gives 404
  r = await api("/api/tickets/9999", "GET");
  check("Missing ticket returns 404", r.status === 404);

  // 11. Delete removes the ticket and its comments and history
  r = await api("/api/tickets/" + id, "DELETE");
  check("Delete returns 200", r.status === 200);
  const leftoverComments = db.prepare("SELECT COUNT(*) AS n FROM comments WHERE ticket_id = ?").get(id).n;
  const leftoverHistory = db.prepare("SELECT COUNT(*) AS n FROM activity_log WHERE ticket_id = ?").get(id).n;
  check("No orphaned comments or history after delete", leftoverComments === 0 && leftoverHistory === 0);

  console.log("\n" + passed + " passed, " + failed + " failed");
  db.close();
  fs.unlinkSync("test.db");
  process.exit(failed === 0 ? 0 : 1);
}

runTests();
