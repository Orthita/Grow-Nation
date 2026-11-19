# Deploying the Grow Nation website

This guide takes the site from your computer to a live server. It is written for someone who is comfortable
copying commands, not for a server expert. Read it once from start to finish before you begin.

---

## 1. What the hosting must provide

| Need | Why |
|---|---|
| **Node.js 20 or newer** (see `"engines"` in `package.json`) | The website and admin panel run on Node.js. |
| **MySQL 8** (MariaDB 10.6+ usually works too) | All content, certificates and admin accounts live here. |
| **Persistent storage for uploads** | Images and PDFs uploaded in the admin panel must survive restarts and redeploys. |
| **SSL / HTTPS** (free Let's Encrypt or AutoSSL is fine) | Admin login only works over HTTPS in production. |
| A way to create a `.env` file and run commands (cPanel Terminal or SSH) | For setup and database creation. |

Ask the host: *"Do you support Node.js 20 apps (for example cPanel 'Setup Node.js App'), MySQL 8, SSH or Terminal access, and free SSL?"*

---

## 2. Before you start: prepare these values

You will put these in the server's `.env` file. **Never** reuse the values from your own computer.

1. **Two different secrets**, each generated separately. Run this twice on any computer with Node.js and keep the two results:
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   - The first one is `SESSION_SECRET`, used to sign admin logins.
   - The second one is `TOTP_KEY`, used to encrypt two-step login keys. The site refuses to start in production without it.
2. **Database name, user and password.** Create these on the host (step A2 or B2).
3. **The first admin's real email** for `ADMIN_EMAIL`. Do not leave it as `you@example.com`, because that becomes the login email.
4. **The first admin's password** for `ADMIN_PASSWORD`, at least 10 characters. If it is left empty, a random one is printed once during setup. Copy it straight away.

### The production `.env`

Start from `.env.example` (copy it to `.env`) and set at least:

```
NODE_ENV=production
PORT=3000                 # cPanel sets this itself; on a VPS keep 3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=...               # from step A2 / B2
DB_PASSWORD=...
DB_NAME=...
SESSION_SECRET=...        # first generated value
TOTP_KEY=...              # second generated value, different from SESSION_SECRET
TRUST_PROXY=1             # both paths below put a proxy in front of the app
UPLOAD_DIR=...            # a folder outside the app folder (see below)
ENQUIRIES_ENABLED=false   # the site has no enquiry form at the moment
ADMIN_NAME=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```

`COOKIE_SECURE` does not matter in production: the login cookie is always HTTPS-only there.

**Never upload your local `.env`.** Create a new one on the server.

---

## 3A. Path A: cPanel "Setup Node.js App"

### A1. Upload the code
1. On your computer, make a zip of the project **without** `node_modules` and **without** `.env`.
2. In cPanel **File Manager**, create a folder outside `public_html`, for example `/home/youruser/grownation`.
3. Upload the zip there and **Extract** it.
4. Create an uploads folder outside it, for example `/home/youruser/grownation-uploads`. Put this path in `UPLOAD_DIR`.

### A2. Create the database
1. cPanel → **MySQL Databases**: create a database (cPanel adds a prefix, e.g. `youruser_grownation`).
2. Create a database user with a strong password.
3. **Add the user to the database** with **All Privileges**.
4. Note the full database name, user and password for `.env`.

### A3. Create the Node.js app
1. cPanel → **Setup Node.js App** → **Create Application**.
2. **Node.js version:** 20 or newer.
3. **Application mode:** Production.
4. **Application root:** `grownation` (the folder from A1).
5. **Application URL:** your domain, e.g. `grownation.org`.
6. **Application startup file:** `server/app.js`.
7. Click **Create**.

### A4. Install and configure
1. In the app's page, copy the command shown at the top ("Enter to the virtual environment…"), open cPanel **Terminal**, paste it and press Enter.
2. Install the packages:
   ```
   npm install --omit=dev
   ```
3. Create `.env` in the app folder (File Manager → New File → `.env`) using section 2.
4. Create the tables, starter content and first admin:
   ```
   npm run init-db
   ```
   If no admin password was set, **copy the printed password now**. It is shown only once.
5. Back in **Setup Node.js App**, click **Restart**.

### A5. HTTPS
cPanel → **SSL/TLS Status** → run **AutoSSL** for the domain (or install a certificate). Then open `https://yourdomain` and check that the padlock shows.

---

## 3B. Path B: a VPS (Ubuntu) with Nginx and PM2

### B1. Install the software (once)
```
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs mysql-server nginx
sudo npm install -g pm2
node -v        # must show v20 or newer
```

### B2. Create the database
```
sudo mysql
CREATE DATABASE grow_nation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'grownation'@'localhost' IDENTIFIED BY 'a-strong-password';
GRANT ALL PRIVILEGES ON grow_nation.* TO 'grownation'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### B3. Upload the code and install
```
sudo mkdir -p /var/www/grownation /var/www/grownation-uploads
sudo chown -R $USER /var/www/grownation /var/www/grownation-uploads
# copy the project into /var/www/grownation (git clone, scp or SFTP), without node_modules and .env
cd /var/www/grownation
npm install --omit=dev
cp .env.example .env
nano .env                 # fill in section 2; UPLOAD_DIR=/var/www/grownation-uploads
chmod 600 .env
npm run init-db           # copy the printed admin password if one is shown
```

### B4. Start it with PM2 (keeps it running and restarts it after a reboot)
```
pm2 start server/app.js --name grownation
pm2 save
pm2 startup               # run the command it prints
pm2 logs grownation       # should show "Database connected."
```

### B5. Nginx in front of the app
Create `/etc/nginx/sites-available/grownation`:
```
server {
    listen 80;
    server_name grownation.org www.grownation.org;
    client_max_body_size 10m;   # admin uploads are up to 8 MB

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Then:
```
sudo ln -s /etc/nginx/sites-available/grownation /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### B6. HTTPS
```
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d grownation.org -d www.grownation.org
```
Certbot renews the certificate automatically.

---

## 4. Daily backups

Back up **both** the database and the uploads folder. A database copy without the uploads loses every image and PDF.

1. Store the database password in a private file so it is not visible in commands. Create `~/.my.cnf`:
   ```
   [mysqldump]
   user=YOUR_DB_USER
   password=YOUR_DB_PASSWORD
   ```
   then run `chmod 600 ~/.my.cnf`.
2. Make a backup folder: `mkdir -p ~/backups`
3. Add a daily job (cPanel → **Cron Jobs**, or `crontab -e` on a VPS). This runs at 02:30, keeps 14 days, and also zips the uploads:
   ```
   30 2 * * * mysqldump --single-transaction YOUR_DB_NAME | gzip > ~/backups/db-$(date +\%F).sql.gz && tar -czf ~/backups/uploads-$(date +\%F).tar.gz -C /path/to/uploads . && find ~/backups -type f -mtime +14 -delete
   ```
4. Once a month, download a backup to your own computer, and try restoring one into a test database once.

To restore: `gunzip < db-2026-12-01.sql.gz | mysql YOUR_DB_NAME`

---

## 5. Checking that the site is healthy

Open **`https://yourdomain/api/health`** in a browser.

| You see | Meaning |
|---|---|
| `{"ok":true,"db":true}` | Everything is working. |
| `{"ok":true,"db":false}` (status 503) | The website runs but cannot reach MySQL. Check `DB_*` in `.env` and that MySQL is running. |
| Error page / nothing | The app is not running. cPanel: Restart in Setup Node.js App. VPS: `pm2 logs grownation`. |

Free uptime monitors (for example UptimeRobot) can check this address every few minutes and email you if it fails.

---

## 6. Updating the site later

1. Back up first (section 4).
2. Upload the changed files (never overwrite the server's `.env` or the uploads folder).
3. If `package.json` changed: `npm install --omit=dev`.
4. Restart: cPanel → **Restart**; VPS → `pm2 restart grownation`.
5. Check `/api/health` and click through the site.

Do **not** run `npm run init-db` again to "update". It only adds starter content to an empty database.

---

## 7. Launch-day checklist

**Server**
- [ ] `NODE_ENV=production`, new `SESSION_SECRET` and a separate `TOTP_KEY` (both 32+ characters)
- [ ] `TRUST_PROXY=1`, `UPLOAD_DIR` outside the app folder, `ENQUIRIES_ENABLED=false`
- [ ] `.env` is not readable by others (`chmod 600 .env`) and was not uploaded from your computer
- [ ] HTTPS works with a padlock; `http://` addresses redirect to `https://` (AutoSSL / Certbot option)
- [ ] `https://yourdomain/api/health` shows `{"ok":true,"db":true}`
- [ ] Daily backups of database **and** uploads are scheduled, and one has been checked

**Admin panel**
- [ ] Log in at `https://yourdomain/admin/login.html` with the real admin email
- [ ] Change the admin password in **My account** if a printed one was used
- [ ] Turn on **two-step login** in **My account**
- [ ] **Contact details:** address, phone, email and website are correct; add WhatsApp if confirmed
- [ ] **Certificates:** only real certificates exist; verify one on `/verify.html`
- [ ] **Home slider:** text and links are correct (`/training.html`, `/consultancy.html`); add images if wanted
- [ ] **Courses and services:** titles, durations and summaries approved by the client
- [ ] Upload one test image, check it shows, then remove it

**Website**
- [ ] Open every page on a phone and on a computer: Home, Our Training Services, Our Consultancy Services, Verification, About Us
- [ ] Footer contact links work (phone, email, website)
- [ ] Enroll Now opens an email with the course in the subject
- [ ] Old addresses redirect: `/services.html`, `/contact.html`, `/resources.html`
