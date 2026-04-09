import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditLog.js';

const router = Router();

router.use(authenticate);

// GET /api/doubts/:classroomId — list doubts for a classroom
router.get('/:classroomId', async (req, res) => {
  try {
    const { classroomId } = req.params;

    // Verify membership
    const [membership] = await pool.execute(
      "SELECT role FROM memberships WHERE user_id = ? AND classroom_id = ? AND status = 'approved'",
      [req.user.id, classroomId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [doubts] = await pool.execute(`
      SELECT d.*, u.username,
        (SELECT COUNT(*) FROM doubt_replies WHERE doubt_id = d.id) AS reply_count
      FROM doubts d
      JOIN users u ON d.user_id = u.id
      WHERE d.classroom_id = ?
      ORDER BY d.created_at DESC
    `, [classroomId]);

    res.json(doubts);
  } catch (err) {
    console.error('Error fetching doubts:', err);
    res.status(500).json({ error: 'Failed to fetch doubts' });
  }
});

// GET /api/doubts/single/:doubtId — get doubt detail with replies
router.get('/single/:doubtId', async (req, res) => {
  try {
    const { doubtId } = req.params;

    const [doubts] = await pool.execute(`
      SELECT d.*, u.username
      FROM doubts d
      JOIN users u ON d.user_id = u.id
      WHERE d.id = ?
    `, [doubtId]);

    if (doubts.length === 0) return res.status(404).json({ error: 'Doubt not found' });

    const doubt = doubts[0];

    // Verify membership in doubt's classroom
    const [membership] = await pool.execute(
      "SELECT id FROM memberships WHERE user_id = ? AND classroom_id = ? AND status = 'approved'",
      [req.user.id, doubt.classroom_id]
    );

    if (membership.length === 0) return res.status(403).json({ error: 'Access denied' });

    const [replies] = await pool.execute(`
      SELECT dr.*, u.username
      FROM doubt_replies dr
      JOIN users u ON dr.user_id = u.id
      WHERE dr.doubt_id = ?
      ORDER BY dr.created_at ASC
    `, [doubtId]);

    res.json({ ...doubt, replies });
  } catch (err) {
    console.error('Error fetching doubt detail:', err);
    res.status(500).json({ error: 'Failed to fetch doubt detail' });
  }
});

// POST /api/doubts/:classroomId — create a doubt
router.post('/:classroomId', async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { title, body } = req.body;

    if (!title || !body) return res.status(400).json({ error: 'Title and body are required' });

    // Verify membership
    const [membership] = await pool.execute(
      "SELECT id FROM memberships WHERE user_id = ? AND classroom_id = ? AND status = 'approved'",
      [req.user.id, classroomId]
    );

    if (membership.length === 0) return res.status(403).json({ error: 'Access denied' });

    const [result] = await pool.execute(
      'INSERT INTO doubts (classroom_id, user_id, title, body) VALUES (?, ?, ?, ?)',
      [classroomId, req.user.id, title, body]
    );

    const [newDoubt] = await pool.execute(`
      SELECT d.*, u.username, 0 AS reply_count
      FROM doubts d
      JOIN users u ON d.user_id = u.id
      WHERE d.id = ?
    `, [result.insertId]);

    res.status(201).json(newDoubt[0]);
  } catch (err) {
    console.error('Error creating doubt:', err);
    res.status(500).json({ error: 'Failed to create doubt' });
  }
});

// POST /api/doubts/:doubtId/reply — reply to a doubt
router.post('/:doubtId/reply', async (req, res) => {
  try {
    const { doubtId } = req.params;
    const { body } = req.body;

    if (!body) return res.status(400).json({ error: 'Reply body is required' });

    // Get doubt to find classroom
    const [doubts] = await pool.execute('SELECT classroom_id FROM doubts WHERE id = ?', [doubtId]);
    if (doubts.length === 0) return res.status(404).json({ error: 'Doubt not found' });

    const classroomId = doubts[0].classroom_id;

    // Verify membership
    const [membership] = await pool.execute(
      "SELECT id FROM memberships WHERE user_id = ? AND classroom_id = ? AND status = 'approved'",
      [req.user.id, classroomId]
    );

    if (membership.length === 0) return res.status(403).json({ error: 'Access denied' });

    const [result] = await pool.execute(
      'INSERT INTO doubt_replies (doubt_id, user_id, body) VALUES (?, ?, ?)',
      [doubtId, req.user.id, body]
    );

    const [newReply] = await pool.execute(`
      SELECT dr.*, u.username
      FROM doubt_replies dr
      JOIN users u ON dr.user_id = u.id
      WHERE dr.id = ?
    `, [result.insertId]);

    res.status(201).json(newReply[0]);
  } catch (err) {
    console.error('Error replying to doubt:', err);
    res.status(500).json({ error: 'Failed to reply to doubt' });
  }
});

// DELETE /api/doubts/:id — delete a doubt
router.delete('/:id', async (req, res) => {
  try {
    const [doubt] = await pool.execute('SELECT user_id, classroom_id FROM doubts WHERE id = ?', [req.params.id]);
    if (doubt.length === 0) {
      await writeAuditLog({
        eventType: 'doubt.delete',
        actorUserId: req.user.id,
        targetType: 'doubt',
        targetId: req.params.id,
        outcome: 'failure',
        req,
        metadata: { reason: 'not_found' },
      });
      return res.status(404).json({ error: 'Doubt not found' });
    }

    const [classroom] = await pool.execute('SELECT owner_id FROM classrooms WHERE id = ?', [doubt[0].classroom_id]);

    // Author or classroom owner can delete
    if (doubt[0].user_id !== req.user.id && classroom[0].owner_id !== req.user.id) {
      await writeAuditLog({
        eventType: 'doubt.delete',
        actorUserId: req.user.id,
        targetType: 'doubt',
        targetId: req.params.id,
        classroomId: doubt[0].classroom_id,
        outcome: 'denied',
        req,
        metadata: { reason: 'owner_or_author_required' },
      });
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.execute('DELETE FROM doubts WHERE id = ?', [req.params.id]);
    await writeAuditLog({
      eventType: 'doubt.delete',
      actorUserId: req.user.id,
      targetType: 'doubt',
      targetId: req.params.id,
      classroomId: doubt[0].classroom_id,
      outcome: 'success',
      req,
    });
    res.json({ message: 'Doubt deleted' });
  } catch (err) {
    console.error('Error deleting doubt:', err);
    await writeAuditLog({
      eventType: 'doubt.delete',
      actorUserId: req.user?.id || null,
      targetType: 'doubt',
      targetId: req.params.id,
      outcome: 'failure',
      req,
      metadata: { reason: 'server_error' },
    });
    res.status(500).json({ error: 'Failed to delete doubt' });
  }
});

// PATCH /api/doubts/:id/status — resolve/reopen doubt
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body; // 'open' or 'resolved'
    if (!['open', 'resolved'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const [doubt] = await pool.execute('SELECT user_id, classroom_id FROM doubts WHERE id = ?', [req.params.id]);
    if (doubt.length === 0) return res.status(404).json({ error: 'Doubt not found' });

    const [classroom] = await pool.execute('SELECT owner_id FROM classrooms WHERE id = ?', [doubt[0].classroom_id]);

    // Author or classroom owner can change status
    if (doubt[0].user_id !== req.user.id && classroom[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.execute('UPDATE doubts SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: `Doubt ${status}` });
  } catch (err) {
    console.error('Error updating doubt status:', err);
    res.status(500).json({ error: 'Failed to update doubt status' });
  }
});

export default router;
