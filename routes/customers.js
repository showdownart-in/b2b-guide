import { Router } from 'express';
import * as pyramid from '../services/pyramid.js';
import * as sync from '../services/sync.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const status = req.query.status || null;
    const company_id = req.query.company_id != null ? Number(req.query.company_id) : null;
    const list = pyramid.listCustomers(status, company_id);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', (req, res) => {
  const customer = pyramid.getCustomer(Number(req.params.id));
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(customer);
});

router.post('/', (req, res) => {
  try {
    const { company_id, first_name, last_name, email, phone, role } = req.body || {};
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'first_name, last_name, and email are required' });
    }
    const customer = pyramid.createCustomer({
      company_id,
      first_name,
      last_name,
      email,
      phone,
      role,
    });
    res.status(201).json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/approve', (req, res) => {
  const customer = pyramid.approveCustomer(Number(req.params.id));
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(customer);
});

router.post('/:id/sync', async (req, res) => {
  try {
    const result = await sync.syncCustomerToShopify(Number(req.params.id));
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
