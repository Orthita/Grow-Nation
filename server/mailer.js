const nodemailer = require('nodemailer');

let transport = null;
if (process.env.SMTP_HOST) {
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

const oneLine = (s) => String(s || '').replace(/[\r\n]+/g, ' ').slice(0, 150);

async function notifyEnquiry(e) {
  const to = process.env.NOTIFY_EMAIL;
  if (!transport || !to) {
    console.log('[mail] SMTP / NOTIFY_EMAIL not set, enquiry saved without email (id ' + e.id + ')');
    return;
  }
  const text = [
    'New enquiry on the Grow Nation website',
    '',
    'Name: ' + e.name,
    'Organisation: ' + (e.organisation || '-'),
    'Phone: ' + (e.phone || '-'),
    'Email: ' + (e.email || '-'),
    'Interested in: ' + (e.interest || '-'),
    '',
    'Message:',
    e.message || '-',
    '',
    'Manage it in the admin panel: Enquiries (id ' + e.id + ')',
  ].join('\n');
  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    replyTo: e.email || undefined,
    subject: 'New enquiry: ' + oneLine(e.name),
    text,
  });
}

async function notifyEnrollment(e) {
  const to = process.env.NOTIFY_EMAIL;
  if (!transport || !to) {
    console.log('[mail] SMTP / NOTIFY_EMAIL not set, enrollment saved without email (id ' + e.id + ')');
    return;
  }
  const text = [
    'New enrollment on the Grow Nation website',
    '',
    'Course: ' + e.course_title,
    'Name: ' + e.name,
    'Email: ' + e.email,
    'Phone: ' + e.phone,
    'Organisation: ' + (e.organisation || '-'),
    'Preferred date: ' + (e.preferred_date || '-'),
    '',
    'Message:',
    e.message || '-',
    '',
    'Manage it in the admin panel: Enrollments (id ' + e.id + ')',
  ].join('\n');
  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    replyTo: e.email,
    subject: 'New enrollment: ' + oneLine(e.course_title) + ' - ' + oneLine(e.name),
    text,
  });
}

module.exports = { notifyEnquiry, notifyEnrollment };
