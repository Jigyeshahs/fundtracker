const express = require('express');
const cors = require('cors');
const path = require('path');

const accountsRouter = require('./routes/accounts');
const transactionsRouter = require('./routes/transactions');
const casesRouter = require('./routes/cases');
const statsRouter = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/accounts', accountsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/cases', casesRouter);
app.use('/api/stats', statsRouter);

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'FundTrace API' }));

app.listen(PORT, () => {
  console.log(`\n  FundTrace backend running → http://localhost:${PORT}`);
  console.log(`  Frontend served from same origin. Open http://localhost:${PORT} in your browser.\n`);
});
