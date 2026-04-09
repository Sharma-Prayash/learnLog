import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { getPresignedUrl, deleteFromS3 } from '../services/s3.js';
import { writeAuditLog } from '../services/auditLog.js';

const router = Router();

router.use(authenticate);

// GET /api/nodes?classroomId= — get nodes for a classroom (approved members only)
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

    // Get nodes with user's progress
    const [nodes] = await pool.execute(`
      SELECT n.*, 
        COALESCE(up.completed, false) AS completed
      FROM nodes n
      LEFT JOIN user_progress up ON up.node_id = n.id AND up.user_id = ?
      WHERE n.classroom_id = ?
      ORDER BY n.type DESC, n.name ASC
    `, [req.user.id, classroomId]);

    // Generate pre-signed URLs for file nodes
    const nodesWithUrls = await Promise.all(
      nodes.map(async (node) => {
        if (node.type === 'file' && node.resource_url) {
          try {
            const signedUrl = await getPresignedUrl(node.resource_url);
            return { ...node, resource_url: signedUrl };
          } catch (err) {
            console.warn(`⚠️  Failed to sign URL for node ${node.id}:`, err.message);
            return node;
          }
        }
        return node;
      })
    );

    res.json(nodesWithUrls);
  } catch (err) {
    console.error('Error fetching nodes:', err);
    res.status(500).json({ error: 'Failed to fetch nodes' });
  }
});

// PUT /api/nodes/:id/progress — toggle completion for current user
router.put('/:id/progress', async (req, res) => {
  try {
    const nodeId = req.params.id;
    const { completed } = req.body;

    if (typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'completed (boolean) is required' });
    }

    const [nodeRows] = await pool.execute('SELECT classroom_id FROM nodes WHERE id = ?', [nodeId]);
    if (nodeRows.length === 0) {
      await writeAuditLog({
        eventType: 'node.delete',
        actorUserId: req.user.id,
        targetType: 'node',
        targetId: nodeId,
        outcome: 'failure',
        req,
        metadata: { reason: 'not_found' },
      });
      return res.status(404).json({ error: 'Node not found' });
    }

    const classroomId = nodeRows[0].classroom_id;

    const [membership] = await pool.execute(
      "SELECT id FROM memberships WHERE user_id = ? AND classroom_id = ? AND status = 'approved'",
      [req.user.id, classroomId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.execute(`
      INSERT INTO user_progress (user_id, node_id, completed) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE completed = ?, updated_at = NOW()
    `, [req.user.id, nodeId, completed, completed]);

    res.json({ message: 'Progress updated' });
  } catch (err) {
    console.error('Error updating progress:', err);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// PUT /api/nodes/:id/rename — rename a node (owner only)
router.put('/:id/rename', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const [nodeRows] = await pool.execute('SELECT classroom_id FROM nodes WHERE id = ?', [req.params.id]);
    if (nodeRows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const [classroom] = await pool.execute(
      'SELECT owner_id FROM classrooms WHERE id = ?',
      [nodeRows[0].classroom_id]
    );

    if (classroom[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the classroom owner can rename nodes' });
    }

    await pool.execute('UPDATE nodes SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
    res.json({ message: 'Node renamed' });
  } catch (err) {
    console.error('Error renaming node:', err);
    res.status(500).json({ error: 'Failed to rename node' });
  }
});

// DELETE /api/nodes/:id — delete node + children + S3 files (owner only)
router.delete('/:id', async (req, res) => {
  try {
    const nodeId = req.params.id;

    const [nodeRows] = await pool.execute(
      'SELECT id, classroom_id, type, resource_url FROM nodes WHERE id = ?',
      [nodeId]
    );

    if (nodeRows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const node = nodeRows[0];

    const [classroom] = await pool.execute(
      'SELECT owner_id FROM classrooms WHERE id = ?',
      [node.classroom_id]
    );

    if (classroom[0].owner_id !== req.user.id) {
      await writeAuditLog({
        eventType: 'node.delete',
        actorUserId: req.user.id,
        targetType: 'node',
        targetId: nodeId,
        classroomId: node.classroom_id,
        outcome: 'denied',
        req,
        metadata: { reason: 'owner_required' },
      });
      return res.status(403).json({ error: 'Only the classroom owner can delete nodes' });
    }

    // Collect all file resource_urls to delete from S3 (this node + all descendants)
    const s3KeysToDelete = [];

    async function collectS3Keys(id) {
      const [rows] = await pool.execute(
        'SELECT id, type, resource_url FROM nodes WHERE id = ?',
        [id]
      );
      if (rows.length === 0) return;

      const n = rows[0];
      if (n.type === 'file' && n.resource_url) {
        s3KeysToDelete.push(n.resource_url);
      }

      // Find children
      const [children] = await pool.execute(
        'SELECT id FROM nodes WHERE parent_id = ?',
        [id]
      );

      for (const child of children) {
        await collectS3Keys(child.id);
      }
    }

    await collectS3Keys(nodeId);

    // Delete from database (CASCADE handles children via foreign key)
    await pool.execute('DELETE FROM nodes WHERE id = ?', [nodeId]);

    // Delete from S3 (fire and forget — don't block response on S3 failures)
    for (const key of s3KeysToDelete) {
      try {
        await deleteFromS3(key);
      } catch (s3Err) {
        console.warn(`⚠️  Failed to delete from S3 (${key}):`, s3Err.message);
      }
    }

    await writeAuditLog({
      eventType: 'node.delete',
      actorUserId: req.user.id,
      targetType: 'node',
      targetId: nodeId,
      classroomId: node.classroom_id,
      outcome: 'success',
      req,
      metadata: { deletedS3Files: s3KeysToDelete.length, nodeType: node.type },
    });
    res.json({ message: 'Node deleted', deleted_s3_files: s3KeysToDelete.length });
  } catch (err) {
    console.error('Error deleting node:', err);
    await writeAuditLog({
      eventType: 'node.delete',
      actorUserId: req.user?.id || null,
      targetType: 'node',
      targetId: req.params.id,
      outcome: 'failure',
      req,
      metadata: { reason: 'server_error' },
    });
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

export default router;
