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

Open **Command Prompt** (Windows key → type `cmd`; not PowerShell, which
can't use `<`) and paste on one line:

```
"C:\xampp\mysql\bin\mysql.exe" --host=HOST --port=PORT --user=avnadmin -p --ssl-ca="C:\Users\Kim Victus\Downloads\ca.pem" --plugin-dir="C:\xampp\mysql\lib\plugin" defaultdb < "C:\Users\Kim Victus\Downloads\bantayledger_cloud.sql"
```

Replace `HOST` and `PORT` with your values. At **Enter password:** paste the
Aiven password (nothing shows while typing) and press Enter. No message means
it worked.

Common problems: "Access denied" = wrong password; "Can't connect" = wrong
host/port or the service isn't Running yet; "Plugin caching_sha2_password
could not be loaded" = the `--plugin-dir=…` part is missing.

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

## 7. Email for "Forgot password" (Brevo, free)

Brevo's free plan sends up to 300 emails a day. Render's free plan blocks the
usual email (SMTP) ports, so the server uses Brevo's web API instead
(`MAIL_MAILER=brevo`, `laravel-server/app/Mail/BrevoApiTransport.php`).

1. Sign up at https://www.brevo.com (free plan).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: the email
   people will see the message from. Brevo emails a code to confirm it.
3. **SMTP & API → API keys → Generate a new API key** (name it
   `BantayLedger Render`). Copy it: it is shown once.
4. In Render, open **bantayledger-api → Environment** and make sure these
   exist (add any that are missing), then **Save, rebuild and deploy**:

| Key | Value |
| --- | --- |
| `MAIL_MAILER` | `brevo` |
| `BREVO_API_KEY` | the API key from step 3 |
| `MAIL_FROM_ADDRESS` | the sender email from step 2 |
| `MAIL_FROM_NAME` | `BantayLedger AI` |
| `FRONTEND_URL` | `https://bantayledger-web.onrender.com` |

To test: on the sign-in page tap **Forgot password?**, enter your email, and
open the link in the email (it expires after 60 minutes). If no email arrives,
check the Spam folder, and Brevo → **Transactional → Logs**.

A Gmail address works as the sender, but some emails may land in Spam because
Gmail can't vouch for Brevo. Sending from your own domain (verified in Brevo)
fixes that.

## 8. Speed: keep the server awake and the database close

**Keep it awake.** Render's free plan puts the server to sleep after 15
minutes without visitors; the next visitor then waits about 30 seconds. A free
pinger stops that:

1. Sign up at https://cron-job.org (free).
2. **Create cronjob** → URL `https://bantayledger-api.onrender.com/api/health`,
   schedule **every 10 minutes** → Create.

This uses about 744 of Render's 750 free hours a month (the website doesn't
use any).

**Keep the database next to the server.** Every database step travels
between the server and the database, so they should be in the same region.
The server is in Oregon (US West); the database should be in US West too.
`DB_PERSISTENT=true` (in `render.yaml`) keeps connections open between requests.

To move the data to a new database, use the copy command from the
`laravel-server` folder. It asks for each database's details; passwords are
typed hidden. Sign-in tokens and caches are not copied (people sign in again).

```
php artisan db:copy
```

1. **Back up the live database to this laptop first.** FROM = the current
   Aiven database (with its `ca.pem`); TO = `127.0.0.1`, port `3306`,
   database `bantayledger_cloud_backup`, user `root`, no password. Create that
   empty database in phpMyAdmin first. Answer **yes** to create the tables.
2. In Aiven, create the new free MySQL service in a **US West** region and
   download its CA certificate (save it as `ca-new.pem`).
3. Run `php artisan db:copy` again: FROM = the laptop backup, TO = the new
   Aiven database (with `ca-new.pem`). Answer **yes** to create the tables.
   It ends with "Done: every table matches."
4. In Render → **bantayledger-api → Environment**, change `DB_HOST`,
   `DB_PORT`, `DB_PASSWORD` and `MYSQL_SSL_CA_PEM` (the text of `ca-new.pem`),
   then **Save, rebuild, and deploy**. Don't record anything between step 1
   and this deploy.
5. Sign in and check your products, sales and staff. After a week of normal
   use, delete the old Aiven service and the laptop backup.
