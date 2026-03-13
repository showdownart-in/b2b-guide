import { useState } from 'react';
import { onboardCompanyWithCustomer } from '../api';
import { useToast } from '../Toast';

export function OnboardForm() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const company = {
      name: form.company_name.value.trim(),
      email: form.company_email.value.trim() || undefined,
      phone: form.company_phone.value.trim() || undefined,
      external_id: form.external_id.value.trim() || undefined,
      address_line1: form.address_line1.value.trim() || undefined,
      address_city: form.address_city.value.trim() || undefined,
      address_province: form.address_province.value.trim() || undefined,
      address_country: form.address_country.value.trim() || undefined,
      address_zip: form.address_zip.value.trim() || undefined,
      projekttyp: form.projekttyp?.value?.trim() || undefined,
      e_postfaktura: form.e_postfaktura?.value?.trim() || undefined,
      kundtyp: form.kundtyp?.value?.trim() || undefined,
      ansvarig_agent: form.ansvarig_agent?.value?.trim() || undefined,
      saljare: form.saljare?.value?.trim() || undefined,
      leveransvillkor: form.leveransvillkor?.value?.trim() || undefined,
    };
    const customer = {
      first_name: form.first_name.value.trim(),
      last_name: form.last_name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim() || undefined,
      role: form.role.value.trim() || undefined,
    };
    setLoading(true);
    try {
      await onboardCompanyWithCustomer(company, customer);
      toast('Company and customer synced to Shopify.');
      form.reset();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card form-card onboard-form">
      <h2>B2B onboarding</h2>
      <p className="form-hint">Enter company and primary contact. One click approves and syncs to Shopify.</p>
      <form className="form" onSubmit={handleSubmit}>
        <fieldset className="form-section">
          <legend>Company</legend>
          <div className="row">
            <label>Company name *</label>
            <input type="text" name="company_name" required placeholder="Acme Corp" />
          </div>
          <div className="row two-cols">
            <div>
              <label>Email</label>
              <input type="email" name="company_email" placeholder="billing@acme.com" />
            </div>
            <div>
              <label>Phone</label>
              <input type="tel" name="company_phone" placeholder="+1 234 567 8900" />
            </div>
          </div>
          <div className="row">
            <label>External ID</label>
            <input type="text" name="external_id" placeholder="PYR-123" />
          </div>
          <div className="row two-cols">
            <div>
              <label>Projekttyp</label>
              <input type="text" name="projekttyp" placeholder="Project type" />
            </div>
            <div>
              <label>E-postfaktura</label>
              <input type="text" name="e_postfaktura" placeholder="Email invoice" />
            </div>
          </div>
          <div className="row two-cols">
            <div>
              <label>Kundtyp</label>
              <input type="text" name="kundtyp" placeholder="Customer type" />
            </div>
            <div>
              <label>Ansvarig agent</label>
              <input type="text" name="ansvarig_agent" placeholder="Responsible agent" />
            </div>
          </div>
          <div className="row two-cols">
            <div>
              <label>Säljare</label>
              <input type="text" name="saljare" placeholder="Seller" />
            </div>
            <div>
              <label>Leveransvillkor</label>
              <input type="text" name="leveransvillkor" placeholder="Delivery terms" />
            </div>
          </div>
        </fieldset>

        <fieldset className="form-section form-section-primary">
          <legend>Primary contact</legend>
          <p className="form-section-desc">Contact person for this company (created as customer and assigned in Shopify).</p>
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
        </fieldset>

        <fieldset className="form-section">
          <legend>Company address</legend>
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
              <label>State / Province (e.g. MH, NY)</label>
              <input type="text" name="address_province" placeholder="MH" />
            </div>
          </div>
          <div className="row two-cols">
            <div>
              <label>Country (e.g. IN, US)</label>
              <input type="text" name="address_country" placeholder="IN" />
            </div>
            <div>
              <label>ZIP / Postal</label>
              <input type="text" name="address_zip" placeholder="400001" />
            </div>
          </div>
        </fieldset>

        <button type="submit" className="btn btn-primary btn-sync" disabled={loading}>
          {loading ? 'Syncing…' : 'Approve & Sync to Shopify'}
        </button>
      </form>
    </div>
  );
}
