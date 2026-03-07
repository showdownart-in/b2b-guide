import { useState } from 'react';
import { createCustomer } from '../api';
import { useToast } from '../Toast';

export function CustomerForm({ companies, onCreated }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      company_id: form.company_id.value ? form.company_id.value : undefined,
      first_name: form.first_name.value.trim(),
      last_name: form.last_name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim() || undefined,
      role: form.role.value.trim() || undefined,
    };
    setLoading(true);
    try {
      await createCustomer(payload);
      toast('Customer created in Pyramid.');
      form.reset();
      onCreated?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card form-card">
      <h2>Add customer (Pyramid)</h2>
      <form className="form" onSubmit={handleSubmit}>
        <div className="row">
          <label>Company</label>
          <select name="company_id">
            <option value="">— None (standalone) —</option>
            {(companies || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.status})
              </option>
            ))}
          </select>
        </div>
        <div className="row two-cols">
          <div>
            <label>First name *</label>
            <input type="text" name="first_name" required placeholder="Jane" />
          </div>
          <div>
            <label>Last name *</label>
            <input type="text" name="last_name" required placeholder="Doe" />
          </div>
        </div>
        <div className="row two-cols">
          <div>
            <label>Email *</label>
            <input type="email" name="email" required placeholder="jane@acme.com" />
          </div>
          <div>
            <label>Phone</label>
            <input type="tel" name="phone" placeholder="+1 234 567 8901" />
          </div>
        </div>
        <div className="row">
          <label>Role</label>
          <input type="text" name="role" placeholder="Buyer" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating…' : 'Create customer'}
        </button>
      </form>
    </div>
  );
}
