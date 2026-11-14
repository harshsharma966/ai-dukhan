// API & WhatsApp Helpers
export const API_BASE = ''; // proxied by Vite to http://127.0.0.1:8000

export function sendWhatsAppMessage(mobile, messageText, promptText = 'Please enter mobile number:') {
  let phone = (mobile || '').replace(/[^0-9]/g, '');
  if (phone.length === 10) {
    phone = '91' + phone;
  }
  if (!phone || phone.length < 10) {
    const inputPhone = prompt(promptText, mobile || '');
    if (!inputPhone) return;
    phone = inputPhone.replace(/[^0-9]/g, '');
    if (phone.length === 10) phone = '91' + phone;
    if (phone.length < 10) {
      alert('Please enter a valid mobile number');
      return;
    }
  }

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;
  window.open(url, '_blank');
}

export function generateBillWhatsAppText(bill, lang = 'hi', shop = null) {
  const shopTitle = bill.shop_name || shop?.shop_name || (lang === 'hi' ? '🏪 आपका किराना स्टोर' : '🏪 Your Kirana Store');
  const shopAddress = bill.shop_address || shop?.address || '';
  const shopPhone = bill.shop_mobile || shop?.mobile || '';
  const dateStr = new Date(bill.created_at || bill.bill_date).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN');
  const custName = bill.customer_name || (lang === 'hi' ? 'नकद ग्राहक (Walk-in)' : 'Walk-in Cash');
  
  let msg = `*${shopTitle}*\n`;
  if (shopAddress) msg += `📍 ${shopAddress}\n`;
  if (shopPhone) msg += `📞 ${shopPhone}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📄 *${lang === 'hi' ? 'बिल नं' : 'Bill No'}:* ${bill.bill_number}\n`;
  msg += `🗓️ *${lang === 'hi' ? 'तारीख' : 'Date'}:* ${dateStr}\n`;
  msg += `👤 *${lang === 'hi' ? 'ग्राहक' : 'Customer'}:* ${custName}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `*${lang === 'hi' ? 'सामान का विवरण' : 'Items'}:*\n`;

  if (bill.items && bill.items.length) {
    bill.items.forEach(it => {
      msg += `• ${it.product_name}: ${it.quantity} ${it.unit} × ₹${Number(it.selling_price).toFixed(1)} = ₹${Number(it.line_total).toFixed(2)}\n`;
    });
  }

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  const subtotal = Number(bill.subtotal !== undefined ? bill.subtotal : bill.total_amount) || 0;
  const discount = Number(bill.discount) || 0;
  const finalAmt = Number(bill.final_amount) || 0;

  msg += `*${lang === 'hi' ? 'कुल रकम (Total)' : 'Subtotal'}:* ₹${subtotal.toFixed(2)}\n`;
  if (discount > 0) {
    msg += `*${lang === 'hi' ? 'छूट (Discount)' : 'Discount'}:* -₹${discount.toFixed(2)}\n`;
  }
  msg += `*${lang === 'hi' ? 'फाइनल देय (Net Amount)' : 'Final Due'}:* ₹${finalAmt.toFixed(2)}\n`;
  msg += `*${lang === 'hi' ? 'भुगतान प्रकार (Mode)' : 'Payment Mode'}:* ${bill.payment_mode}\n`;

  if (bill.payment_mode === 'CASH' && Number(bill.change_amount) > 0) {
    msg += `*${lang === 'hi' ? 'छुट्टे वापस (Change)' : 'Change'}:* ₹${Number(bill.change_amount).toFixed(2)}\n`;
  }

  const billDue = Number(bill.due_amount) || 0;
  if (billDue > 0) {
    msg += `*${lang === 'hi' ? 'इस बिल का उधार' : 'This Bill Credit'}:* ₹${billDue.toFixed(2)}\n`;
  }

  if (bill.customer_id) {
    const liveDue = Number(bill.current_balance_now !== undefined ? bill.current_balance_now : (bill.customer_current_due !== undefined ? bill.customer_current_due : 0));
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (liveDue > 0) {
      msg += `📒 *${lang === 'hi' ? 'खाते में कुल बकाया' : 'Total Due'}:* ₹${liveDue.toFixed(2)}\n`;
    } else {
      msg += `📒 *${lang === 'hi' ? 'खाता स्थिति' : 'Account Status'}:* ${lang === 'hi' ? 'चुकता (₹0.00 No Due) ✓' : 'Settled (₹0.00 No Due) ✓'}\n`;
    }
  }

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `${lang === 'hi' ? 'धन्यवाद! फिर पधारें 🙏' : 'Thank you! Visit again 🙏'}\n`;
  return msg;
}

export function sendUdhaarWhatsAppReminder(customerName, mobile, dueAmount, lang = 'hi', promptText = '', shop = null) {
  const shopTitle = shop?.shop_name || (lang === 'hi' ? 'किराना स्टोर' : 'Kirana Store');
  let msg = `नमस्ते ${customerName} जी 🙏\n\n`;
  msg += `आपके *${shopTitle}* के खाते में कुल बकाया राशि *₹${Number(dueAmount).toFixed(2)}* है।\n\n`;
  msg += `कृपया सुविधा अनुसार भुगतान करने का कष्ट करें।\n`;
  if (shop?.mobile) {
    msg += `(ऑनलाइन भुगतान के लिए दुकान के UPI: ${shop.mobile} पर भी भेज सकते हैं)\n\n`;
  } else {
    msg += `(ऑनलाइन भुगतान के लिए दुकान के UPI पर भी भेज सकते हैं)\n\n`;
  }
  msg += `धन्यवाद! 🙏\n-${shopTitle}`;
  
  sendWhatsAppMessage(mobile, msg, promptText);
}

export function generatePaymentReceiptWhatsAppText(receipt, lang = 'hi', shop = null) {
  const shopTitle = receipt.shop_name || shop?.shop_name || (lang === 'hi' ? '🏪 किराना स्टोर' : '🏪 Kirana Store');
  const shopAddress = receipt.shop_address || shop?.address || '';
  const shopPhone = receipt.shop_mobile || shop?.mobile || '';
  const dateStr = receipt.payment_date 
    ? new Date(receipt.payment_date).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN')
    : new Date().toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN');
  const custName = receipt.customer_name || '';
  const receiptNo = receipt.receipt_number || `PAY-${receipt.payment_id || ''}`;
  const amountPaid = Number(receipt.amount_paid) || 0;
  const prevDue = Number(receipt.previous_due) || 0;
  const newDue = Number(receipt.new_due) || 0;
  const mode = receipt.payment_mode === 'UPI' ? 'UPI' : (lang === 'hi' ? 'नकद (CASH)' : 'CASH');

  let msg = `*${shopTitle}*\n`;
  if (shopAddress) msg += `📍 ${shopAddress}\n`;
  if (shopPhone) msg += `📞 ${shopPhone}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🧾 *${lang === 'hi' ? 'उधारी भुगतान रसीद' : 'Payment Receipt'}*\n`;
  msg += `📄 *${lang === 'hi' ? 'रसीद नं' : 'Receipt No'}:* ${receiptNo}\n`;
  msg += `🗓️ *${lang === 'hi' ? 'तारीख' : 'Date'}:* ${dateStr}\n`;
  msg += `👤 *${lang === 'hi' ? 'ग्राहक' : 'Customer'}:* ${custName}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💰 *${lang === 'hi' ? 'जमा राशि' : 'Amount Paid'}:* ₹${amountPaid.toFixed(2)}\n`;
  msg += `💳 *${lang === 'hi' ? 'भुगतान प्रकार' : 'Payment Mode'}:* ${mode}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📉 *${lang === 'hi' ? 'पिछला बकाया' : 'Previous Due'}:* ₹${prevDue.toFixed(2)}\n`;
  if (newDue <= 0) {
    msg += `✅ *${lang === 'hi' ? 'अब कुल बकाया' : 'Remaining Due'}:* ₹0.00 (${lang === 'hi' ? 'खाता चुकता ✓' : 'Settled ✓'})\n`;
  } else {
    msg += `📒 *${lang === 'hi' ? 'अब शेष बकाया' : 'Remaining Due'}:* ₹${newDue.toFixed(2)}\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `${lang === 'hi' ? 'धन्यवाद! आपका भुगतान प्राप्त हुआ 🙏' : 'Thank you! Payment received successfully 🙏'}\n`;
  return msg;
}

