import express from 'express';
import cors from 'cors';
import companiesRouter from './routes/companies.js';
import customersRouter from './routes/customers.js';
import onboardRouter from './routes/onboard.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/companies', companiesRouter);
app.use('/api/customers', customersRouter);
app.use('/api/onboard', onboardRouter);

// Serve frontend
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`B2B Pyramid → Shopify sync app running at http://localhost:${PORT}`);
});
