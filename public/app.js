// app.js - the frontend logic.
// Flow: user clicks something -> a function below runs -> fetch() calls the API -> we show the result.

let agents = [];            // list of support agents (filled when the page loads)
let currentTicketId = null; // the ticket that is open in the detail view

// ---------- Helper functions ----------

// Talk to the backend. Returns { ok: true/false, data: ... }
async function callApi(url, method, body) {
  const options = { method: method, headers: { "Content-Type": "application/json" } };
  if (body) {
    options.body = JSON.stringify(body);
  }
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { ok: response.ok, data: data };
  } catch (error) {
    return { ok: false, data: { error: "Could not reach the server." } };
  }
}

// Stops user text from being treated as HTML (protects against XSS)
function safe(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// "Waiting on Customer" -> "Waiting-on-Customer" (used for CSS class names)
function cssName(text) {
  return text.split(" ").join("-");
}

function formatTime(isoText) {
  return new Date(isoText).toLocaleString();
}

// Show one of the three views and hide the other two
function showView(viewName) {
  const views = ["listView", "createView", "detailView"];
  for (let i = 0; i < views.length; i++) {
    if (views[i] === viewName) {
      document.getElementById(views[i]).style.display = "block";
    } else {
      document.getElementById(views[i]).style.display = "none";
    }
  }
}

// ---------- Page start ----------

async function startApp() {
  const result = await callApi("/api/agents", "GET");
  agents = result.data;

  // Fill the three dropdowns that list agents
  for (let i = 0; i < agents.length; i++) {
    const option1 = "<option value='" + agents[i].id + "'>" + safe(agents[i].name) + "</option>";
    document.getElementById("filterAssignee").innerHTML += option1;
    document.getElementById("editAssignee").innerHTML += option1;
    const option2 = "<option value='" + safe(agents[i].name) + "'>" + safe(agents[i].name) + "</option>";
    document.getElementById("commentAuthor").innerHTML += option2;
  }
  showList();
}

// ---------- View 1: dashboard and list ----------

function showList() {
  showView("listView");
  loadDashboard();
  loadTickets();
}

async function loadDashboard() {
  const result = await callApi("/api/dashboard", "GET");
  const d = result.data;
  document.getElementById("dashboard").innerHTML =
    "<div class='card'><b>" + d.total + "</b>Total</div>" +
    "<div class='card'><b>" + d.open + "</b>Open</div>" +
    "<div class='card'><b>" + d.inProgress + "</b>In Progress</div>" +
    "<div class='card'><b>" + d.resolved + "</b>Resolved</div>" +
    "<div class='card red'><b>" + d.urgent + "</b>Urgent</div>" +
    "<div class='card red'><b>" + d.overdue + "</b>Overdue</div>";
}

async function loadTickets() {
  const message = document.getElementById("listMessage");
  message.textContent = "Loading tickets...";

  // Build the URL, e.g. /api/tickets?status=Open&priority=High
  const params = new URLSearchParams();
  const search = document.getElementById("searchBox").value;
  const status = document.getElementById("filterStatus").value;
  const priority = document.getElementById("filterPriority").value;
  const assignee = document.getElementById("filterAssignee").value;
  const sort = document.getElementById("sortBy").value;
  if (search) { params.append("search", search); }
  if (status) { params.append("status", status); }
  if (priority) { params.append("priority", priority); }
  if (assignee) { params.append("assignee", assignee); }
  params.append("sort", sort);

  const result = await callApi("/api/tickets?" + params.toString(), "GET");
  if (!result.ok) {
    message.textContent = result.data.error;
    return;
  }

  const tickets = result.data;
  const rows = document.getElementById("ticketRows");
  rows.innerHTML = "";

  if (tickets.length === 0) {
    message.textContent = "No tickets found.";
    return;
  }
  message.textContent = "";

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    let assigneeName = "Unassigned";
    if (t.assignee_name) {
      assigneeName = t.assignee_name;
    }
    let overdueTag = "";
    if (t.overdue) {
      overdueTag = "<span class='overdue'>OVERDUE</span>";
    }

    rows.innerHTML +=
      "<tr onclick='openTicket(" + t.id + ")'>" +
      "<td>" + safe(t.subject) + overdueTag + "</td>" +
      "<td>" + safe(t.customer) + "</td>" +
      "<td><span class='badge s-" + cssName(t.status) + "'>" + t.status + "</span></td>" +
      "<td><span class='badge p-" + t.priority + "'>" + t.priority + "</span></td>" +
      "<td>" + safe(assigneeName) + "</td>" +
      "<td>" + formatTime(t.updated_at) + "</td>" +
      "</tr>";
  }
}

// ---------- View 2: create ticket ----------

function showCreate() {
  document.getElementById("createError").textContent = "";
  showView("createView");
}

async function createTicket() {
  const error = document.getElementById("createError");
  const subject = document.getElementById("newSubject").value.trim();
  const customer = document.getElementById("newCustomer").value.trim();
  const description = document.getElementById("newDescription").value.trim();

  // Client-side check (the server checks again too)
  if (subject === "" || customer === "" || description === "") {
    error.textContent = "Subject, customer and description are required.";
    return;
  }

  const result = await callApi("/api/tickets", "POST", {
    subject: subject,
    customer: customer,
    description: description,
    priority: document.getElementById("newPriority").value,
    status: document.getElementById("newStatus").value
  });

  if (!result.ok) {
    error.textContent = result.data.error;
    return;
  }

  // Clear the form and go back to the list
  document.getElementById("newSubject").value = "";
  document.getElementById("newCustomer").value = "";
  document.getElementById("newDescription").value = "";
  showList();
}

// ---------- View 3: ticket detail ----------

async function openTicket(id) {
  currentTicketId = id;
  document.getElementById("detailError").textContent = "";
  document.getElementById("detailSuccess").textContent = "";

  const result = await callApi("/api/tickets/" + id, "GET");
  if (!result.ok) {
    alert(result.data.error);
    return;
  }
  const t = result.data;

  // Fill the edit form
  let title = "#" + t.id + " - " + safe(t.subject);
  if (t.overdue) {
    title += " <span class='overdue'>OVERDUE</span>";
  }
  document.getElementById("detailTitle").innerHTML = title;
  document.getElementById("editSubject").value = t.subject;
  document.getElementById("editCustomer").value = t.customer;
  document.getElementById("editDescription").value = t.description;
  document.getElementById("editStatus").value = t.status;
  document.getElementById("editPriority").value = t.priority;
  if (t.assignee_id) {
    document.getElementById("editAssignee").value = t.assignee_id;
  } else {
    document.getElementById("editAssignee").value = "";
  }

  // Replies and notes (already in time order from the server)
  const commentList = document.getElementById("commentList");
  commentList.innerHTML = "";
  if (t.comments.length === 0) {
    commentList.innerHTML = "<p>No replies or notes yet.</p>";
  }
  for (let i = 0; i < t.comments.length; i++) {
    const c = t.comments[i];
    let label = "Public reply";
    let cssClass = "comment";
    if (c.type === "internal") {
      label = "INTERNAL NOTE (not visible to the customer)";
      cssClass = "comment internal";
    }
    commentList.innerHTML +=
      "<div class='" + cssClass + "'>" +
      "<small><b>" + label + "</b> - " + safe(c.author) + " - " + formatTime(c.created_at) + "</small>" +
      safe(c.content) +
      "</div>";
  }

  // Activity history
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "";
  for (let i = 0; i < t.history.length; i++) {
    historyList.innerHTML += "<li>" + formatTime(t.history[i].created_at) + " - " + safe(t.history[i].message) + "</li>";
  }

  showView("detailView");
}

async function saveTicket() {
  const error = document.getElementById("detailError");
  const success = document.getElementById("detailSuccess");
  error.textContent = "";
  success.textContent = "";

  const subject = document.getElementById("editSubject").value.trim();
  const customer = document.getElementById("editCustomer").value.trim();
  const description = document.getElementById("editDescription").value.trim();
  if (subject === "" || customer === "" || description === "") {
    error.textContent = "Subject, customer and description are required.";
    return;
  }

  const result = await callApi("/api/tickets/" + currentTicketId, "PUT", {
    subject: subject,
    customer: customer,
    description: description,
    status: document.getElementById("editStatus").value,
    priority: document.getElementById("editPriority").value,
    assignee_id: document.getElementById("editAssignee").value
  });

  if (!result.ok) {
    error.textContent = result.data.error;
    return;
  }

  await openTicket(currentTicketId); // reload to show the new history
  document.getElementById("detailSuccess").textContent = "Ticket saved.";
}

async function addComment(type) {
  const error = document.getElementById("detailError");
  error.textContent = "";

  const content = document.getElementById("commentText").value.trim();
  if (content === "") {
    error.textContent = "Please write a message first.";
    return;
  }

  const result = await callApi("/api/tickets/" + currentTicketId + "/comments", "POST", {
    type: type,
    content: content,
    author: document.getElementById("commentAuthor").value
  });

  if (!result.ok) {
    error.textContent = result.data.error;
    return;
  }

  document.getElementById("commentText").value = "";
  openTicket(currentTicketId);
}

async function deleteTicket() {
  // Ask first, because deleting cannot be undone
  const sure = confirm("Delete this ticket and all its replies and history?");
  if (!sure) {
    return;
  }

  const result = await callApi("/api/tickets/" + currentTicketId, "DELETE");
  if (!result.ok) {
    document.getElementById("detailError").textContent = result.data.error;
    return;
  }
  showList();
}

startApp();
