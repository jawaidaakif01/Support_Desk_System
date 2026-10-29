# AI prompts used

Tool: Claude (chat, claude.ai)

These are my prompts in the order I used them, shortened and in my own words.

1. I shared the task PDF and asked how to approach it: what to build and in what order in 3 hours.
   - What I got: a stack suggestion (Node, Express, SQLite), 4 tables, a list of API routes and a rough timeline.
   - What I did: compared it with each section of the PDF (tickets, notes, filters, history, dashboard).

2. "Keep the code as simple and beginner friendly as possible, as few files and folders as possible, no extra frameworks, so I can explain it in the interview."
   - What I got: the first full version (db.js, server.js, three frontend files, README).
   - What I did: ran it and clicked through the screens (create ticket, replies, internal notes, history).

3. I pasted the company's instruction (CRUD app, any database, basic responsive front end, focus on backend data handling) and asked if my version fits.
   - What I got: it told me delete was missing and added a delete route plus a button, and made the table scroll on small screens.

4. I asked it to add database indexes, a small test script and a prompts file.
   - What I got: 3 indexes in db.js, test.js (run with npm test) and a template for this file.

5. "Split the routes out of the one large file into separate files, but keep it simple."
   - What I got: server.js now only starts the app, and the routes are in routes/tickets.js, routes/agents.js and routes/dashboard.js, with shared functions in helpers.js.

## Where the AI was wrong or I had to change something

The first version had no delete, and the README even said deleting tickets was not allowed. When I read the company's instruction that it should be a CRUD app, I asked for delete to be added. Also everything was in one big server.js file, which I asked to split.

## What I decided myself

I chose a simple structure over a fancy design, kept plain JavaScript and SQLite because of the time limit, and picked this version to submit because I can explain every part of it.