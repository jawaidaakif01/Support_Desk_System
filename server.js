// server.js - starts the app and connects the route files.
// Flow: Browser page -> fetch("/api/...") -> route file -> database -> JSON back.

const express = require("express");

const app = express();
app.use(express.json());            // lets us read JSON sent by the frontend
app.use(express.static("public"));  // serves the files inside the public folder

// Each URL starting with /api/... is handled by one route file
app.use("/api/tickets", require("./routes/tickets"));
app.use("/api/agents", require("./routes/agents"));
app.use("/api/dashboard", require("./routes/dashboard"));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Support Desk running at http://localhost:" + PORT);
});
