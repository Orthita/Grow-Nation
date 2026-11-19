const mysql = require('mysql2/promise');

// Cloud MySQL hosts (Aiven, TiDB Cloud, Railway, PlanetScale...) need an encrypted connection: set DB_SSL=true.
// DB_SSL_CA may hold the provider's CA certificate (the PEM text, with \n for line breaks).
const sslOn = /^(1|true|yes|on|required)$/i.test(String(process.env.DB_SSL || '').trim());
const ssl = sslOn
  ? (process.env.DB_SSL_CA
    ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true }
    : { rejectUnauthorized: true, minVersion: 'TLSv1.2' })
  : undefined;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: +process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'grow_nation',
  waitForConnections: true,
  // Serverless functions run many small copies of the app, so each keeps only a few connections.
  connectionLimit: process.env.VERCEL ? 3 : 10,
  ssl,
  charset: 'utf8mb4',
  dateStrings: true, // DATE / DATETIME come back as plain strings
});

module.exports = pool;
