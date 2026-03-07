import { useState } from 'react';
import { createCompany } from '../api';
import { useToast } from '../Toast';

export function CompanyForm({ onCreated, onCompanyOptionsChange }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim() || undefined,
      phone: form.phone.value.trim() || undefined,
      external_id: form.external_id.value.trim() || undefined,
      address_line1: form.address_line1.value.trim() || undefined,
      address_city: form.address_city.value.trim() || undefined,
      address_province: form.address_province.value.trim() || undefined,
      address_country: form.address_country.value.trim() || undefined,
      address_zip: form.address_zip.value.trim() || undefined,
    };
    setLoading(true);
    try {
      await createCompany(payload);
      toast('Company created in Pyramid.');
      form.reset();
      onCreated?.();
      onCompanyOptionsChange?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card form-card">
      <h2>Add company (Pyramid)</h2>
      <form className="form" onSubmit={handleSubmit}>
        <div className="row">
          <label>Company name *</label>
          <input type="text" name="name" required placeholder="Acme Corp" />
        </div>
        <div className="row two-cols">
          <div>
            <label>Email</label>
            <input type="email" name="email" placeholder="billing@acme.com" />
          </div>
          <div>
            <label>Phone</label>
            <input type="tel" name="phone" placeholder="+1 234 567 8900" />
          </div>
        </div>
        <div className="row">
          <label>External ID</label>
          <input type="text" name="external_id" placeholder="PYR-123" />
        </div>
        <div className="row">
          <label>Address line 1</label>
          <input type="text" name="address_line1" placeholder="123 Main St" />
        </div>
        <div className="row two-cols">
          <div>
            <label>City</label>
            <input type="text" name="address_city" placeholder="New York" />
          </div>
          <div>
            <label>State / Province</label>
            <input type="text" name="address_province" placeholder="NY" />
          </div>
        </div>
        <div className="row two-cols">
          <div>
            <label>Country</label>
            <input type="text" name="address_country" placeholder="US" />
          </div>
          <div>
            <label>ZIP / Postal</label>
            <input type="text" name="address_zip" placeholder="10001" />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating…' : 'Create company'}
        </button>
      </form>
    </div>
  );
}
