import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditLog.js';

const router = Router();

router.use(authenticate);

// GET /api/comments?nodeId= — list comments for a node (approved members)
router.get('/', async (req, res) => {
  try {
    const { nodeId } = req.query;
    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId is required' });
    }

    // Get node's classroom
    const [nodeRows] = await pool.execute('SELECT classroom_id FROM nodes WHERE id = ?', [nodeId]);
    if (nodeRows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const classroomId = nodeRows[0].classroom_id;

    // Verify approved membership
    const [membership] = await pool.execute(
      "SELECT id FROM memberships WHERE user_id = ? AND classroom_id = ? AND status = 'approved'",
      [req.user.id, classroomId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get classroom owner for permission checks
    const [classroom] = await pool.execute('SELECT owner_id FROM classrooms WHERE id = ?', [classroomId]);
    const ownerId = classroom[0]?.owner_id;

    const [comments] = await pool.execute(`
      SELECT lc.*, u.username
      FROM lesson_comments lc
      JOIN users u ON lc.user_id = u.id
      WHERE lc.node_id = ?
      ORDER BY lc.created_at DESC
    `, [nodeId]);

    // Add can_delete flag
    const result = comments.map((c) => ({
      ...c,
      can_delete: c.user_id === req.user.id || req.user.id === ownerId,
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/comments — create a comment (approved members)
router.post('/', async (req, res) => {
  try {
    const { nodeId, body } = req.body;

    if (!nodeId || !body || !body.trim()) {
      return res.status(400).json({ error: 'nodeId and body are required' });
    }

    // Get node's classroom
    const [nodeRows] = await pool.execute('SELECT classroom_id FROM nodes WHERE id = ?', [nodeId]);
    if (nodeRows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const classroomId = nodeRows[0].classroom_id;

    // Verify approved membership
    const [membership] = await pool.execute(
      "SELECT id FROM memberships WHERE user_id = ? AND classroom_id = ? AND status = 'approved'",
      [req.user.id, classroomId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [result] = await pool.execute(
      'INSERT INTO lesson_comments (node_id, user_id, body) VALUES (?, ?, ?)',
      [nodeId, req.user.id, body.trim()]
    );

    // Fetch the newly created comment with username
    const [rows] = await pool.execute(`
      SELECT lc.*, u.username
      FROM lesson_comments lc
      JOIN users u ON lc.user_id = u.id
      WHERE lc.id = ?
    `, [result.insertId]);

    const comment = rows[0];
    comment.can_delete = true; // author can always delete their own

    res.status(201).json(comment);
  } catch (err) {
    console.error('Error creating comment:', err);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// DELETE /api/comments/:id — delete comment (author or classroom owner)
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT lc.user_id, lc.node_id FROM lesson_comments lc WHERE lc.id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      await writeAuditLog({
        eventType: 'comment.delete',
        actorUserId: req.user.id,
        targetType: 'comment',
        targetId: req.params.id,
        outcome: 'failure',
        req,
        metadata: { reason: 'not_found' },
      });
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = rows[0];

    // If not the author, check if classroom owner
    if (comment.user_id !== req.user.id) {
      const [nodeRows] = await pool.execute('SELECT classroom_id FROM nodes WHERE id = ?', [comment.node_id]);
      const [classroom] = await pool.execute('SELECT owner_id FROM classrooms WHERE id = ?', [nodeRows[0].classroom_id]);

      if (classroom[0].owner_id !== req.user.id) {
        await writeAuditLog({
          eventType: 'comment.delete',
          actorUserId: req.user.id,
          targetType: 'comment',
          targetId: req.params.id,
          classroomId: nodeRows[0].classroom_id,
          outcome: 'denied',
          req,
          metadata: { reason: 'owner_or_author_required' },
        });
        return res.status(403).json({ error: 'You can only delete your own comments' });
      }
    }

    await pool.execute('DELETE FROM lesson_comments WHERE id = ?', [req.params.id]);
    await writeAuditLog({
      eventType: 'comment.delete',
      actorUserId: req.user.id,
      targetType: 'comment',
      targetId: req.params.id,
      outcome: 'success',
      req,
    });
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('Error deleting comment:', err);
    await writeAuditLog({
      eventType: 'comment.delete',
      actorUserId: req.user?.id || null,
      targetType: 'comment',
      targetId: req.params.id,
      outcome: 'failure',
      req,
      metadata: { reason: 'server_error' },
    });
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
