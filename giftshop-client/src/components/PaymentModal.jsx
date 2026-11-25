import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { payWithRazorpay } from '../utils/payment';
import { money } from '../utils/format';
import { Modal, Spinner } from './ui';

/** Takes payment for an order. Mock mode shows a demo screen; Razorpay mode opens the real checkout. */
export default function PaymentModal({ payment, onPaid, onClose }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!payment) return null;

  const pay = async () => {
    setBusy(true);
    try {
      const order = payment.provider === 'razorpay'
        ? await payWithRazorpay(payment, user)
        : (await api.post('/payments/mock-pay', { orderId: payment.orderId })).data.order;
      toast.success('Payment received');
      onPaid(order);
    } catch (err) {
      toast.error(err.response ? errorMessage(err) : err.message);
    } finally {
      setBusy(false);
    }
  };

  const amount = payment.provider === 'razorpay' ? payment.amount / 100 : payment.amount;
  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Complete your payment">
      <p className="text-muted">Your order is placed and the gifts are reserved for 30 minutes while you pay.</p>
      <div className="mt-5 flex items-center justify-between rounded-xl bg-bg px-4 py-3">
        <span>Amount to pay</span><span className="font-display text-2xl">{money(amount)}</span>
      </div>
      {payment.provider === 'mock' && (
        <p className="mt-4 rounded-xl bg-lavender/30 px-4 py-3 text-sm">This is a demo payment. No money is taken. Add Razorpay test keys on the server to use the real checkout.</p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Pay later</button>
        <button type="button" className="btn-accent" onClick={pay} disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}Pay {money(amount)}
        </button>
      </div>
    </Modal>
  );
}
