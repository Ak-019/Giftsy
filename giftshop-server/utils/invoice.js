// Streams a PDF invoice straight to the HTTP response (nothing is written to disk).
const PDFDocument = require('pdfkit');

// The built-in PDF fonts have no rupee sign, so invoices use "Rs."
const money = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;

function streamInvoice(order, user, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderNumber}.pdf"`);
  doc.pipe(res);

  doc.fontSize(22).text('Giftsy', { continued: true }).fontSize(12).text('   Tax Invoice', { align: 'right' });
  doc.moveDown();
  doc.fontSize(10)
    .text(`Invoice / Order no: ${order.orderNumber}`)
    .text(`Order date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`)
    .text(`Payment: ${order.paymentMethod} (${order.paymentStatus})`)
    .text(`Status: ${order.status}`);
  doc.moveDown();

  const a = order.shippingAddress;
  doc.fontSize(11).text('Ship to:', { underline: true }).fontSize(10)
    .text(a.fullName).text(a.line1);
  if (a.line2) doc.text(a.line2);
  doc.text(`${a.city}, ${a.state} - ${a.pincode}`).text(`Phone: ${a.phone}`);
  if (user) doc.text(`Customer: ${user.name} <${user.email}>`);
  doc.moveDown();

  // Items table
  const cols = { item: 50, qty: 330, price: 380, total: 470 };
  const header = doc.y;
  doc.font('Helvetica-Bold')
    .text('Item', cols.item, header).text('Qty', cols.qty, header)
    .text('Price', cols.price, header).text('Amount', cols.total, header);
  doc.moveTo(50, doc.y + 3).lineTo(545, doc.y + 3).stroke();
  doc.font('Helvetica').moveDown(0.5);

  order.items.forEach((i) => {
    const y = doc.y;
    const name = i.variant ? `${i.name} (${i.variant})` : i.name;
    doc.text(name, cols.item, y, { width: 270 });
    const after = doc.y;
    doc.text(String(i.qty), cols.qty, y).text(money(i.price), cols.price, y).text(money(i.price * i.qty), cols.total, y);
    doc.y = Math.max(after, doc.y);
    doc.moveDown(0.3);
  });

  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.5);
  const line = (label, value, bold = false) => {
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(label, cols.price - 60, y).text(value, cols.total, y);
    doc.moveDown(0.2);
  };
  line('Subtotal', money(order.subtotal));
  if (order.discount) line(`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, `- ${money(order.discount)}`);
  if (order.giftWrapFee) line('Gift wrap', money(order.giftWrapFee));
  line('Shipping', order.shippingFee ? money(order.shippingFee) : 'Free');
  line('Total', money(order.total), true);

  if (order.giftMessage) {
    doc.moveDown().font('Helvetica-Oblique').text(`Gift message: "${order.giftMessage}"`, 50);
  }
  doc.moveDown(2).font('Helvetica').fontSize(9).fillColor('gray')
    .text('This is a computer-generated invoice for a demo project.', 50, doc.y, { align: 'center' });
  doc.end();
}

module.exports = streamInvoice;
