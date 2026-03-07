import { Router } from 'express';
import * as sync from '../services/sync.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { company, customer } = req.body || {};
    if (!company?.name) return res.status(400).json({ error: 'company.name is required' });
    if (!customer?.first_name || !customer?.last_name || !customer?.email) {
      return res.status(400).json({ error: 'customer.first_name, last_name, and email are required' });
    }
    const result = await sync.onboardCompanyWithCustomer(company, customer);
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
