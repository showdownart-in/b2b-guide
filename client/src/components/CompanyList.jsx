import { useState, useEffect, useCallback } from 'react';
import { getCompanies, approveCompany, syncCompany } from '../api';
import { useToast } from '../Toast';

export function CompanyList({ refresh, onCompanyOptionsChange }) {
  const toast = useToast();
  const [companies, setCompanies] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getCompanies(statusFilter || null);
      setCompanies(Array.isArray(list) ? list : []);
    } catch (err) {
      toast(err.message, 'error');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load, refresh]);

  const handleApprove = async (id) => {
    try {
      await approveCompany(id);
      toast('Company approved.');
      load();
      onCompanyOptionsChange?.();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleSync = async (id) => {
    setSyncingId(id);
    try {
      await syncCompany(id);
      toast('Company and contacts synced to Shopify.');
      load();
      onCompanyOptionsChange?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="card table-card">
      <h2>Companies</h2>
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
        ) : !companies.length ? (
          <p className="empty">No companies yet. Create one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.email || '—'}</td>
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
