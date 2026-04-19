import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import employeesRouter from './routes/employees.js';
import payrollRouter from './routes/payroll.js';
import usersRouter from './routes/users.js';
import leavesRouter from './routes/leaves.js';
import expensesRouter from './routes/expenses.js';
import documentsRouter from './routes/documents.js';
import dashboardRouter from './routes/dashboard.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*', credentials: true }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/dashboard', dashboardRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Erreur serveur' });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API WPS SIF démarrée sur http://localhost:${PORT}`);
});
