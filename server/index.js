import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/connection.js';
import authRouter from './routes/auth.js';
import classroomsRouter from './routes/classrooms.js';
import membershipsRouter from './routes/memberships.js';
import nodesRouter from './routes/nodes.js';
import uploadRouter from './routes/upload.js';
import announcementsRouter from './routes/announcements.js';
import commentsRouter from './routes/comments.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/classrooms', classroomsRouter);
app.use('/api/memberships', membershipsRouter);
app.use('/api/nodes', nodesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/comments', commentsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 LearnLog server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
