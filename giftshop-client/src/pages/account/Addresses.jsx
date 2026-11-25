import { useState } from 'react';
import { MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage, fieldErrors } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import useTitle from '../../hooks/useTitle';
import AddressForm from '../../components/AddressForm';
import { ConfirmDialog, EmptyState, Modal } from '../../components/ui';

export default function Addresses() {
  useTitle('Addresses');
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(null); // null, 'new' or an address
  const [deleting, setDeleting] = useState(null);
  const [serverErrors, setServerErrors] = useState({});
  const addresses = user.addresses || [];

  const save = async (body) => {
    setServerErrors({});
    try {
      const { data } = editing === 'new'
        ? await api.post('/account/addresses', body)
        : await api.put(`/account/addresses/${editing._id}`, body);
      setUser((u) => ({ ...u, addresses: data.addresses }));
      setEditing(null);
      toast.success('Address saved');
    } catch (err) {
      setServerErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    }
  };

  const run = async (request, message) => {
    try {
      const { data } = await request();
      setUser((u) => ({ ...u, addresses: data.addresses }));
      toast.success(message);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-3xl">Saved addresses</h2>
        {addresses.length > 0 && <button type="button" className="btn-primary btn-sm" onClick={() => setEditing('new')}>Add address</button>}
      </div>
      {addresses.length === 0 ? (
        <EmptyState icon={MapPin} title="No saved addresses" action={<button type="button" className="btn-primary" onClick={() => setEditing('new')}>Add an address</button>}>
          Save addresses for yourself and the people you send gifts to.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a._id} className="card flex flex-col p-5 text-sm">
              <p className="font-semibold">{a.label || 'Address'} {a.isDefault && <span className="chip-sage ml-1">Default</span>}</p>
              <p className="mt-2 text-muted">{a.fullName}<br />{a.line1}{a.line2 && <>, {a.line2}</>}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</p>
              <div className="mt-4 flex gap-4">
                <button type="button" className="link" onClick={() => setEditing(a)}>Edit</button>
                {!a.isDefault && <button type="button" className="link" onClick={() => run(() => api.put(`/account/addresses/${a._id}`, { isDefault: true }), 'Default address updated')}>Make default</button>}
                <button type="button" className="text-muted hover:text-danger" onClick={() => setDeleting(a)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add an address' : 'Edit address'} wide>
        {editing && (
          <AddressForm initial={editing === 'new' ? {} : editing} onSubmit={save} onCancel={() => setEditing(null)} showDefault serverErrors={serverErrors} />
        )}
      </Modal>
      <ConfirmDialog open={Boolean(deleting)} title="Delete this address?" message={deleting ? `${deleting.label || 'Address'}: ${deleting.line1}, ${deleting.city}` : ''}
        confirmLabel="Delete address" danger onClose={() => setDeleting(null)}
        onConfirm={async () => { await run(() => api.delete(`/account/addresses/${deleting._id}`), 'Address deleted'); setDeleting(null); }} />
    </div>
  );
}
