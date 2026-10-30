# Assess & Advise (Rand Worldwide)

A self-guided interview for a client's staff, plus a password-protected dashboard for the consultant.

- **`/`**: the interview form. It's a public link that needs no login. Answers save as people type, and each person gets a private link to come back to their answers.
- **`/admin`**: the dashboard: live charts, every response, CSV and research-dataset exports, client settings (name, logo, colours, due date, confidentiality), and automatic findings drafted by Claude.

Each client gets its own deployment and its own database, so their data never mixes.

## Deploy on Railway (about 10 minutes)

1. **Put the code on GitHub.** Create a new **private** repository (for example `assess-advise`), then upload these files. Using GitHub Desktop or the command line:
   ```bash
   git init && git add . && git commit -m "Assess & Advise"
   git branch -M main
   git remote add origin https://github.com/<you>/assess-advise.git
   git push -u origin main
   ```
2. **Create the Railway project.** In Railway, choose **New Project → Deploy from GitHub repo** and pick the repository. Railway detects Node and runs `npm start`.
3. **Add the database.** In the same project, choose **+ Create → Database → PostgreSQL**. Then open the app service's **Variables** tab and add a reference variable: `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`. The tables are created automatically on first start.
4. **Set the variables** on the app service:

   | Variable | Value |
   |---|---|
   | `ADMIN_PASSWORD` | A long password for the dashboard |
   | `SESSION_SECRET` | Any long random string |
   | `ANTHROPIC_API_KEY` | Optional. Turns on automatic findings (console.anthropic.com) |
   | `ANTHROPIC_MODEL` | Optional. Defaults to `claude-sonnet-5-5` |
   | `CLIENT_NAME` | `Acton Ostry Architects` (editable later in Settings) |
5. **Get the link.** Go to **Settings → Networking → Generate Domain**. You can also add a custom domain such as `assess.rand.com`.
6. Open `https://<your-domain>/admin`, sign in, and go to **Settings**. Upload the client's logo, set the colours, the due date and the confidentiality option, then send staff the main link.

## A new client

In Railway, duplicate the project (or deploy the same repository into a new project with its own PostgreSQL), and set `CLIENT_NAME`. Each project gets its own link and its own data.

## Run locally

```bash
npm install
ADMIN_PASSWORD=dev npm start      # http://localhost:3000 and /admin
```
Without `DATABASE_URL`, answers are stored in `data/local.json`. Use this for testing only.

## How it works

- Answers are stored in PostgreSQL. Each respondent gets a random private token, and the database stores only a hash of it.
- Only fields defined in `public/questions.js` are accepted. Edit that file to change the questions; the form, dashboard, exports and AI prompt all follow it.
- About 90 seconds after a submission, if `ANTHROPIC_API_KEY` is set, the server asks Claude to draft findings: themes, recommendations scored by impact and effort, and follow-up questions. Names and off-the-record notes are never sent to Claude.
- **Export research dataset** includes only respondents who agreed to research use, with names and off-the-record notes removed. Collected over several engagements, these files are the training and example data for a future Rand assessment model.
