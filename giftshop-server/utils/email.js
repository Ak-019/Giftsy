// Sends emails through SMTP when SMTP_HOST is set. Otherwise it only logs, so the app works without email setup.
const nodemailer = require('nodemailer');
const { escapeHtml } = require('./helpers');

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true }); // builds the email but sends nothing
  }
  return transporter;
}

// Never throws: a failed email must not fail the order
async function sendMail({ to, subject, html }) {
  if (process.env.NODE_ENV === 'test' || !to) return;
  try {
    await getTransporter().sendMail({ from: process.env.MAIL_FROM || 'Giftsy <no-reply@giftsy.local>', to, subject, html });
    if (!process.env.SMTP_HOST) console.log(`[email] SMTP not configured, skipped: "${subject}" to ${to}`);
  } catch (err) {
    console.error('[email] failed:', err.message);
  }
}

const money = (n) => `₹${Number(n).toFixed(2)}`;

function itemsTable(order) {
  const rows = order.items
    .map((i) => `<tr><td>${escapeHtml(i.name)}${i.variant ? ` (${escapeHtml(i.variant)})` : ''}</td><td>${i.qty}</td><td>${money(i.price * i.qty)}</td></tr>`)
    .join('');
  return `<table cellpadding="6" style="border-collapse:collapse">${rows}
    <tr><td colspan="2"><b>Total</b></td><td><b>${money(order.total)}</b></td></tr></table>`;
}

function orderPlacedEmail(order, user) {
  return sendMail({
    to: user.email,
    subject: `Order ${order.orderNumber} confirmed`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Thanks for your order! Here is a summary:</p>${itemsTable(order)}
      ${order.giftMessage ? `<p>Gift message: <i>${escapeHtml(order.giftMessage)}</i></p>` : ''}
      <p>We'll let you know when it ships.</p>`,
  });
}

function orderStatusEmail(order, user) {
  return sendMail({
    to: user.email,
    subject: `Order ${order.orderNumber} is now ${order.status}`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Your order <b>${order.orderNumber}</b> is now <b>${order.status}</b>.</p>${itemsTable(order)}`,
  });
}

module.exports = { sendMail, orderPlacedEmail, orderStatusEmail };
