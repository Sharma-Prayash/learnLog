import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditLog.js';

const router = Router();

router.use(authenticate);

// GET /api/announcements?classroomId= — list announcements (approved members only)
router.get('/', async (req, res) => {
  try {
    const { classroomId } = req.query;
    if (!classroomId) {
      return res.status(400).json({ error: 'classroomId is required' });
    }

    // Verify approved membership
    const [membership] = await pool.execute(
      "SELECT id FROM memberships WHERE user_id = ? AND classroom_id = ? AND status = 'approved'",
      [req.user.id, classroomId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [announcements] = await pool.execute(`
      SELECT a.*, u.username AS author_name
      FROM announcements a
      JOIN users u ON a.author_id = u.id
      WHERE a.classroom_id = ?
      ORDER BY a.created_at DESC
    `, [classroomId]);

    res.json(announcements);
  } catch (err) {
    console.error('Error fetching announcements:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// POST /api/announcements — create announcement (classroom owner only)
router.post('/', async (req, res) => {
  try {
    const { classroomId, title, body } = req.body;

    if (!classroomId || !title || !body) {
      return res.status(400).json({ error: 'classroomId, title, and body are required' });
    }

    // Verify owner
    const [classroom] = await pool.execute(
      'SELECT owner_id FROM classrooms WHERE id = ?',
      [classroomId]
    );

    if (classroom.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classroom[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the classroom owner can post announcements' });
    }

    const [result] = await pool.execute(
      'INSERT INTO announcements (classroom_id, author_id, title, body) VALUES (?, ?, ?, ?)',
      [classroomId, req.user.id, title, body]
    );

    // Fetch the newly created announcement with author name
    const [rows] = await pool.execute(`
      SELECT a.*, u.username AS author_name
      FROM announcements a
      JOIN users u ON a.author_id = u.id
      WHERE a.id = ?
    `, [result.insertId]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating announcement:', err);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// DELETE /api/announcements/:id — delete announcement (author only)
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT author_id FROM announcements WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      await writeAuditLog({
        eventType: 'announcement.delete',
        actorUserId: req.user.id,
        targetType: 'announcement',
        targetId: req.params.id,
        outcome: 'failure',
        req,
        metadata: { reason: 'not_found' },
      });
      return res.status(404).json({ error: 'Announcement not found' });
    }

    if (rows[0].author_id !== req.user.id) {
      await writeAuditLog({
        eventType: 'announcement.delete',
        actorUserId: req.user.id,
        targetType: 'announcement',
        targetId: req.params.id,
        outcome: 'denied',
        req,
        metadata: { reason: 'author_required' },
      });
      return res.status(403).json({ error: 'Only the author can delete this announcement' });
    }

    await pool.execute('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    await writeAuditLog({
      eventType: 'announcement.delete',
      actorUserId: req.user.id,
      targetType: 'announcement',
      targetId: req.params.id,
      outcome: 'success',
      req,
    });
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    console.error('Error deleting announcement:', err);
    await writeAuditLog({
      eventType: 'announcement.delete',
      actorUserId: req.user?.id || null,
      targetType: 'announcement',
      targetId: req.params.id,
      outcome: 'failure',
      req,
      metadata: { reason: 'server_error' },
    });
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

export default router;
