import express from 'express';
import authRoutes from './routes/auth';
import cors from 'cors';

const app = express();

// CORS setup: allow frontend URLs from .env or fallback to all origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['*'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Parse JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth routes
app.use('/auth', authRoutes);

// Health check
app.get('/', (_req, res) => res.send('Firebase Auth Backend OK'));

export default app;
