# Putting BantayLedger online (Render free + Aiven free MySQL)

The app's server (Laravel, in `laravel-server/`) runs on **Render** as a Docker
service, and its database runs on **Aiven** (free MySQL). Render's own free
database is PostgreSQL, which this app's database code does not support, so
the database lives on Aiven.

**Free plan limits (good for a demo or school defense, not for a real store):**

- Render sleeps after 15 minutes with no visits. The next visit waits up to a
  minute while it wakes; the app shows "Connecting to the server…".
- Files saved on Render (uploaded product photos) disappear when it sleeps or
  restarts. Products then show their initials instead.
- Aiven may switch the free database off after a long time unused. It emails
  you first; turn it back on in the Aiven console.
- Paid plans (Render Starter, Aiven Developer) remove these limits.

You create the accounts and type the passwords yourself — never paste them in
a chat.

---

## 1. Put the code on GitHub

Render deploys from your GitHub repository. The repo needs `render.yaml` and
`laravel-server/Dockerfile` (already in the project) pushed to GitHub.

## 2. Create the free MySQL database (Aiven)

1. Sign in at <https://console.aiven.io> → **Create service** → **MySQL** → **Free plan**.
2. When it is running, open it and note from **Connection information**:
   host, port, user (`avnadmin`), password and database (`defaultdb`).
3. Download the **CA certificate** (`ca.pem`) from the same page.

## 3. Copy your data into it

The file `bantayledger_cloud.sql` (in your Downloads folder) holds your
current business data (no login tokens — everyone signs in again online).
In the project folder, run (it asks for the Aiven password):

```
C:\xampp\mysql\bin\mysql.exe --host=HOST --port=PORT --user=avnadmin -p --ssl-ca=C:\path\to\ca.pem defaultdb < C:\Users\Kim Victus\Downloads\bantayledger_cloud.sql
```

Replace `HOST`, `PORT` and the `ca.pem` path with your values.

## 4. Create the server on Render

1. Sign in at <https://dashboard.render.com> → **New** → **Blueprint** → choose your GitHub repository.
2. Render reads `render.yaml` and asks for the secret values:

| Name | What to paste |
|---|---|
| `APP_KEY` | the `APP_KEY=` value from `laravel-server/.env` (starts with `base64:`) |
| `APP_URL` | the service address Render shows, e.g. `https://bantayledger-api.onrender.com` (you can fill it after the first deploy) |
| `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | from Aiven step 2 |
| `MYSQL_SSL_CA_PEM` | open `ca.pem` in Notepad and paste **all** of it, including the BEGIN/END lines |

3. Click **Apply**. The first build takes several minutes.

## 5. Check it

Open `https://YOUR-SERVICE.onrender.com/api/health` in a browser. It should
show `{"ok":true}` (the first visit may take up to a minute).

## 6. Point the app at it

Create a file named `.env.production` in the project folder (next to
`package.json`) with one line:

```
VITE_API_URL=https://YOUR-SERVICE.onrender.com/api
```

Then build the Android app — see `docs/ANDROID_BUILD.md`.
