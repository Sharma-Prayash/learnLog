import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/connection.js';
import { authenticate, generateToken } from '../middleware/auth.js';
import { validatePassword } from '../security/passwordPolicy.js';
import { writeAuditLog } from '../services/auditLog.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!username || !email || !password) {
      await writeAuditLog({
        eventType: 'auth.register',
        outcome: 'failure',
        req,
        metadata: { reason: 'missing_fields', email, username },
      });
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      await writeAuditLog({
        eventType: 'auth.register',
        outcome: 'failure',
        req,
        metadata: { reason: 'password_policy', email, username },
      });
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Check if email or username already exists
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existing.length > 0) {
      await writeAuditLog({
        eventType: 'auth.register',
        outcome: 'failure',
        req,
        metadata: { reason: 'duplicate_account', email, username },
      });
      return res.status(409).json({ error: 'Email or username already taken' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    const user = { id: result.insertId, username, email };
    const token = generateToken(user);

    await writeAuditLog({
      eventType: 'auth.register',
      actorUserId: user.id,
      targetType: 'user',
      targetId: user.id,
      outcome: 'success',
      req,
      metadata: { email },
    });

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Registration error:', err);
    await writeAuditLog({
      eventType: 'auth.register',
      outcome: 'failure',
      req,
      metadata: { reason: 'server_error' },
    });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      await writeAuditLog({
        eventType: 'auth.login',
        outcome: 'failure',
        req,
        metadata: { reason: 'missing_fields', email },
      });
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [users] = await pool.execute(
      'SELECT id, username, email, password_hash FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      await writeAuditLog({
        eventType: 'auth.login',
        outcome: 'failure',
        req,
        metadata: { reason: 'invalid_credentials', email },
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      await writeAuditLog({
        eventType: 'auth.login',
        actorUserId: user.id,
        targetType: 'user',
        targetId: user.id,
        outcome: 'failure',
        req,
        metadata: { reason: 'invalid_credentials', email },
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken({ id: user.id, username: user.username, email: user.email });

    await writeAuditLog({
      eventType: 'auth.login',
      actorUserId: user.id,
      targetType: 'user',
      targetId: user.id,
      outcome: 'success',
      req,
      metadata: { email },
    });

    res.json({
      user: { id: user.id, username: user.username, email: user.email },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    await writeAuditLog({
      eventType: 'auth.login',
      outcome: 'failure',
      req,
      metadata: { reason: 'server_error' },
    });
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me — current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

export default router;
