import { useState, useEffect, useCallback } from 'react';
import { getCustomers, approveCustomer, syncCustomer } from '../api';
import { useToast } from '../Toast';

export function CustomerList({ refresh }) {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getCustomers(statusFilter || null, null);
      setCustomers(Array.isArray(list) ? list : []);
    } catch (err) {
      toast(err.message, 'error');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load, refresh]);

  const handleApprove = async (id) => {
    try {
      await approveCustomer(id);
      toast('Customer approved.');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleSync = async (id) => {
    setSyncingId(id);
    try {
      await syncCustomer(id);
      toast('Customer synced to Shopify.');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="card table-card">
      <h2>Customers</h2>
      <div className="filter">
        <label>Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="synced">Synced</option>
        </select>
      </div>
      <div className="table-wrap">
        {loading ? (
          <p className="empty">Loading…</p>
        ) : !customers.length ? (
          <p className="empty">No customers yet. Create one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Company ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.first_name} {c.last_name}</td>
                  <td>{c.email}</td>
                  <td>{c.company_id != null ? c.company_id : '—'}</td>
                  <td>
                    <span className={`status status-${c.status}`}>{c.status}</span>
                  </td>
                  <td className="actions">
                    {c.status === 'pending' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-approve"
                        onClick={() => handleApprove(c.id)}
                      >
                        Approve
                      </button>
                    )}
                    {c.status === 'approved' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-sync"
                        onClick={() => handleSync(c.id)}
                        disabled={syncingId !== null}
                      >
                        {syncingId === c.id ? 'Syncing…' : 'Sync to Shopify'}
                      </button>
                    )}
                    {c.status === 'synced' && (
                      <span className="text-muted">Synced</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
