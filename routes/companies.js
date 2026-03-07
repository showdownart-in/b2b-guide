import { Router } from 'express';
import * as pyramid from '../services/pyramid.js';
import * as sync from '../services/sync.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const status = req.query.status || null;
    const list = pyramid.listCompanies(status);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', (req, res) => {
  const company = pyramid.getCompany(Number(req.params.id));
  if (!company) return res.status(404).json({ error: 'Company not found' });
  res.json(company);
});

router.post('/', (req, res) => {
  try {
    const { name, external_id, email, phone, address_line1, address_city, address_province, address_country, address_zip } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const company = pyramid.createCompany({
      name,
      external_id,
      email,
      phone,
      address_line1,
      address_city,
      address_province,
      address_country,
      address_zip,
    });
    res.status(201).json(company);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/approve', (req, res) => {
  const company = pyramid.approveCompany(Number(req.params.id));
  if (!company) return res.status(404).json({ error: 'Company not found' });
  res.json(company);
});

router.post('/:id/sync', async (req, res) => {
  try {
    console.log('syncing company to Shopify', req.params.id);
    const result = await sync.syncCompanyToShopify(Number(req.params.id));
    res.json(result);
  } catch (e) {
    console.error('error syncing company to Shopify', e);
    res.status(400).json({ error: e.message });
  }
});

export default router;
