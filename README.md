# Grow Nation website

Express (Node.js) API + MySQL database + plain HTML/CSS/JavaScript pages + a private admin panel.
Built from the Grow Nation prototype and the Website Development Proposal (November 2026).

## What is inside

```
grow-nation/
├── database/schema.sql      11 tables (the 10 from the proposal + settings)
├── database/seed.sql        starter content from your prototype
├── scripts/init-db.js       creates database, tables, content and the first admin
├── scripts/selftest.js      npm test (no database needed)
├── server/                  Express API (app.js, routes/, middleware/, lib/)
│   └── uploads/             images and files uploaded from the admin panel
└── public/                  the website
    ├── index.html, about.html, resources.html, services.html, verify.html, contact.html
    ├── css/style.css, js/*.js
    └── admin/               login.html, dashboard.html
```

## Run it on your computer

1. Install **Node.js 18+ (LTS)** and **MySQL 8** (Workbench is optional).
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env` and fill it in. At least: `DB_PASSWORD`, `SESSION_SECRET` (long random text, see the command inside the file) and `ADMIN_EMAIL`.
4. Run `npm run init-db`. It creates the database and tables, adds starter content and creates your first Super admin (if `ADMIN_PASSWORD` is empty it prints a random password, change it after the first login).
   The same can be done by hand with the mysql command line: `mysql -u root -p < database/schema.sql` then `mysql -u root -p grow_nation < database/seed.sql`.
5. Run `npm start` and open http://localhost:3000. Admin panel: http://localhost:3000/admin/login.html

Test the API in **Postman** with the same calls the pages use, for example:
`GET /api/courses?type=training`, `GET /api/certificates/GN-FS-2026-0142`, `POST /api/enquiries` (JSON body: name, phone or email, interest, message).

## Pages and API

| Page | What it does | API it calls |
|---|---|---|
| Home | Hero, slider, six programme areas, verifier box, testimonials | `/api/courses`, `/api/slides`, `/api/testimonials` |
| About | Founder, mission, vision, process | none |
| Our Resources | Filterable learning, career and workplace resources with downloads | `/api/resources` |
| Our Services | Training / Consultancy tabs with Enroll Now, plus course catalogue | `/api/courses` |
| Verification | Valid / Expired / Revoked / Not found | `GET /api/certificates/:number` |
| Contact | Enquiry form (Enroll Now opens it with the course filled in) | `POST /api/enquiries`, `/api/settings` |

The verifier never shows the holder's name, only course, dates and status. It is rate limited.

## Admin panel (`/admin/login.html`)

| Role | Can manage |
|---|---|
| Super admin | everything, staff users, activity log |
| Editor | courses, categories, batch dates, resources, slider, testimonials, contact details |
| Certificate officer | certificates (issue, edit, revoke) |
| Support | enquiries (new, contacted, closed) |

Every change is written to the activity log. Each person can turn on **two-step login** under *My account* (works with Google Authenticator, Microsoft Authenticator, Authy). Do this for every admin account.

## Before you go live

- [ ] Delete or replace the 3 **demo certificates** (Admin > Certificates). They were copied from the prototype.
- [ ] Fill in phone, email and WhatsApp (Admin > Contact details). The WhatsApp button appears once a number is set.
- [ ] Add **real** testimonials only, with permission. None are included on purpose.
- [ ] Upload photos and PDFs from the admin panel (Courses, Slider, Resources).
- [ ] Set `SMTP_*` and `NOTIFY_EMAIL` in `.env` so new enquiries are emailed to your team (they are always saved in MySQL either way).
- [ ] Use a new strong `SESSION_SECRET`, set `NODE_ENV=production` and `COOKIE_SECURE=true`.
- [ ] Turn on two-step login for every admin.

## Deploying (VPS or Node hosting)

1. Install Node.js, MySQL and Nginx. Create a MySQL user just for this app (do not use `root`).
2. Upload the project, run `npm install --omit=dev`, create `.env`, run `npm run init-db`.
3. Run with PM2: `npm i -g pm2 && pm2 start server/app.js --name grow-nation && pm2 save && pm2 startup`.
4. Nginx reverse proxy to `http://127.0.0.1:3000`, then HTTPS with Let's Encrypt (`certbot --nginx`).
5. Daily backup (cron, 2 am): `mysqldump -u USER -pPASSWORD grow_nation | gzip > /backups/grow_nation_$(date +\%F).sql.gz` and copy `server/uploads/` too. Keep backups on another machine.

## Security built in

HTTPS-only cookies in production, helmet security headers with a Content-Security-Policy, bcrypt password hashes, prepared (parameterised) SQL only, input checks on every form and admin field, rate limits (login, enquiries, verifier, whole API), spam trap field on the enquiry form, CSRF header check on all admin writes, role checks on every admin route, accounts re-checked on each request (deactivating a user logs them out at once), file uploads limited to images, PDF and Office files up to 8 MB with random names, and 2FA keys encrypted in the database.

## Not built yet (Phase 2 in the proposal)

Online payment (bKash, Nagad, card), QR code on certificates, Bangla/English switch, blog and news, certificate PDF generation. The `batches` table and Next batch label are already in place for the batch calendar.

## Notes on the proposal

- Colours follow the proposal palette (violet `#6D28D9`). Your prototype used `#4527A0`. To change, edit the `:root` variables at the top of `public/css/style.css` and `public/admin/admin.css`.
- Services tabs: Training, Consultancy, plus the Course catalogue tab from your prototype.
- `courses.listing` tells the site whether a record is a Services card or a catalogue row. Certificates can link to either.
