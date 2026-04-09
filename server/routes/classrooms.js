import { Router } from 'express';
import { randomInt } from 'crypto';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditLog.js';

const router = Router();

// Generate a random invite code without ambiguous characters.
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars[randomInt(chars.length)];
  }
  return code;
}

// All routes require authentication
router.use(authenticate);

// POST /api/classrooms — create classroom
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Classroom name is required' });
    }

    // Generate a unique invite code (retry on collision)
    let inviteCode;
    let attempts = 0;
    while (attempts < 10) {
      inviteCode = generateInviteCode();
      const [existing] = await pool.execute(
        'SELECT id FROM classrooms WHERE invite_code = ?',
        [inviteCode]
      );
      if (existing.length === 0) break;
      attempts++;
    }

    const [result] = await pool.execute(
      'INSERT INTO classrooms (name, description, owner_id, invite_code) VALUES (?, ?, ?, ?)',
      [name, description || null, req.user.id, inviteCode]
    );

    // Auto-create membership as teacher (approved)
    await pool.execute(
      "INSERT INTO memberships (user_id, classroom_id, role, status) VALUES (?, ?, 'teacher', 'approved')",
      [req.user.id, result.insertId]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      description: description || null,
      owner_id: req.user.id,
      invite_code: inviteCode,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error creating classroom:', err);
    res.status(500).json({ error: 'Failed to create classroom' });
  }
});

// GET /api/classrooms — list my classrooms (teaching + learning)
router.get('/', async (req, res) => {
  try {
    // Classrooms I own (teaching)
    const [teaching] = await pool.execute(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM memberships WHERE classroom_id = c.id AND role = 'student' AND status = 'approved') AS student_count,
        (SELECT COUNT(*) FROM memberships WHERE classroom_id = c.id AND role = 'student' AND status = 'pending') AS pending_count,
        (SELECT COUNT(*) FROM nodes WHERE classroom_id = c.id AND type = 'file') AS total_lessons
      FROM classrooms c
      WHERE c.owner_id = ?
      ORDER BY c.created_at DESC
    `, [req.user.id]);

    // Classrooms I've enrolled in (learning — approved only)
    const [learning] = await pool.execute(`
      SELECT c.id, c.name, c.description, c.owner_id, c.created_at, m.status,
        (SELECT COUNT(*) FROM nodes WHERE classroom_id = c.id AND type = 'file') AS total_lessons,
        (SELECT COUNT(*) FROM user_progress up 
         JOIN nodes n ON up.node_id = n.id 
         WHERE n.classroom_id = c.id AND n.type = 'file' AND up.user_id = ? AND up.completed = true
        ) AS completed_lessons,
        u.username AS owner_name
      FROM memberships m
      JOIN classrooms c ON m.classroom_id = c.id
      JOIN users u ON c.owner_id = u.id
      WHERE m.user_id = ? AND m.role = 'student' AND m.status = 'approved'
      ORDER BY c.created_at DESC
    `, [req.user.id, req.user.id]);

    const learningWithProgress = learning.map((c) => ({
      ...c,
      progress: c.total_lessons > 0 ? Math.round((c.completed_lessons / c.total_lessons) * 100) : 0,
    }));

    // Classrooms with pending membership
    const [pendingMemberships] = await pool.execute(`
      SELECT c.*, m.status,
        u.username AS owner_name
      FROM memberships m
      JOIN classrooms c ON m.classroom_id = c.id
      JOIN users u ON c.owner_id = u.id
      WHERE m.user_id = ? AND m.role = 'student' AND m.status = 'pending'
      ORDER BY m.created_at DESC
    `, [req.user.id]);

    res.json({ teaching, learning: learningWithProgress, pending: pendingMemberships });
  } catch (err) {
    console.error('Error listing classrooms:', err);
    res.status(500).json({ error: 'Failed to list classrooms' });
  }
});

// GET /api/classrooms/:id — get classroom detail (must be approved member)
router.get('/:id', async (req, res) => {
  try {
    const classroomId = req.params.id;

    // Check membership
    const [membership] = await pool.execute(
      "SELECT role, status FROM memberships WHERE user_id = ? AND classroom_id = ? AND status = 'approved'",
      [req.user.id, classroomId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not an approved member.' });
    }

    const [rows] = await pool.execute(`
      SELECT c.*,
        (SELECT COUNT(*) FROM nodes WHERE classroom_id = c.id AND type = 'file') AS total_lessons,
        (SELECT COUNT(*) FROM user_progress up 
         JOIN nodes n ON up.node_id = n.id 
         WHERE n.classroom_id = c.id AND n.type = 'file' AND up.user_id = ? AND up.completed = true
        ) AS completed_lessons,
        (SELECT COUNT(*) FROM memberships WHERE classroom_id = c.id AND role = 'student' AND status = 'approved') AS student_count,
        (SELECT COUNT(*) FROM memberships WHERE classroom_id = c.id AND role = 'student' AND status = 'pending') AS pending_count
      FROM classrooms c 
      WHERE c.id = ?
    `, [req.user.id, classroomId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    const classroom = rows[0];
    classroom.progress = classroom.total_lessons > 0
      ? Math.round((classroom.completed_lessons / classroom.total_lessons) * 100)
      : 0;
    classroom.role = membership[0].role;
    classroom.is_owner = classroom.owner_id === req.user.id;
    if (!classroom.is_owner) {
      delete classroom.invite_code;
    }

    res.json(classroom);
  } catch (err) {
    console.error('Error getting classroom:', err);
    res.status(500).json({ error: 'Failed to get classroom' });
  }
});

// DELETE /api/classrooms/:id — delete (owner only)
router.delete('/:id', async (req, res) => {
  try {
    const [classroom] = await pool.execute(
      'SELECT owner_id FROM classrooms WHERE id = ?',
      [req.params.id]
    );

    if (classroom.length === 0) {
      await writeAuditLog({
        eventType: 'classroom.delete',
        actorUserId: req.user.id,
        targetType: 'classroom',
        targetId: req.params.id,
        outcome: 'failure',
        req,
        metadata: { reason: 'not_found' },
      });
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classroom[0].owner_id !== req.user.id) {
      await writeAuditLog({
        eventType: 'classroom.delete',
        actorUserId: req.user.id,
        targetType: 'classroom',
        targetId: req.params.id,
        outcome: 'denied',
        req,
        metadata: { reason: 'owner_required' },
      });
      return res.status(403).json({ error: 'Only the owner can delete this classroom' });
    }

    await pool.execute('DELETE FROM classrooms WHERE id = ?', [req.params.id]);
    await writeAuditLog({
      eventType: 'classroom.delete',
      actorUserId: req.user.id,
      targetType: 'classroom',
      targetId: req.params.id,
      classroomId: Number(req.params.id),
      outcome: 'success',
      req,
    });
    res.json({ message: 'Classroom deleted successfully' });
  } catch (err) {
    console.error('Error deleting classroom:', err);
    await writeAuditLog({
      eventType: 'classroom.delete',
      actorUserId: req.user?.id || null,
      targetType: 'classroom',
      targetId: req.params.id,
      outcome: 'failure',
      req,
      metadata: { reason: 'server_error' },
    });
    res.status(500).json({ error: 'Failed to delete classroom' });
  }
});

// GET /api/classrooms/:id/students — list approved students with progress (owner only)
router.get('/:id/students', async (req, res) => {
  try {
    const classroomId = req.params.id;

    // Verify owner
    const [classroom] = await pool.execute(
      'SELECT owner_id FROM classrooms WHERE id = ?',
      [classroomId]
    );

    if (classroom.length === 0) return res.status(404).json({ error: 'Classroom not found' });
    if (classroom[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Owner access required' });

    const [students] = await pool.execute(`
      SELECT u.id, u.username, u.email, m.created_at AS joined_at,
        (SELECT COUNT(*) FROM nodes WHERE classroom_id = ? AND type = 'file') AS total_lessons,
        (SELECT COUNT(*) FROM user_progress up 
         JOIN nodes n ON up.node_id = n.id 
         WHERE n.classroom_id = ? AND n.type = 'file' AND up.user_id = u.id AND up.completed = true
        ) AS completed_lessons
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE m.classroom_id = ? AND m.role = 'student' AND m.status = 'approved'
      ORDER BY u.username ASC
    `, [classroomId, classroomId, classroomId]);

    const result = students.map((s) => ({
      ...s,
      progress: s.total_lessons > 0 ? Math.round((s.completed_lessons / s.total_lessons) * 100) : 0,
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// GET /api/classrooms/:id/pending — list pending requests (owner only)
router.get('/:id/pending', async (req, res) => {
  try {
    const classroomId = req.params.id;

    const [classroom] = await pool.execute(
      'SELECT owner_id FROM classrooms WHERE id = ?',
      [classroomId]
    );

    if (classroom.length === 0) return res.status(404).json({ error: 'Classroom not found' });
    if (classroom[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Owner access required' });

    const [pending] = await pool.execute(`
      SELECT m.id AS membership_id, u.id AS user_id, u.username, u.email, m.created_at
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE m.classroom_id = ? AND m.role = 'student' AND m.status = 'pending'
      ORDER BY m.created_at ASC
    `, [classroomId]);

    res.json(pending);
  } catch (err) {
    console.error('Error fetching pending requests:', err);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// POST /api/classrooms/:id/students/:userId/reset — reset student progress (owner only)
router.post('/:id/students/:userId/reset', async (req, res) => {
  try {
    const classroomId = req.params.id;
    const studentId = req.params.userId;

    // Verify owner
    const [classroom] = await pool.execute(
      'SELECT owner_id FROM classrooms WHERE id = ?',
      [classroomId]
    );

    if (classroom.length === 0) return res.status(404).json({ error: 'Classroom not found' });
    if (classroom[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Owner access required' });

    // Delete all progress for this student in this classroom
    // Since progress is linked to nodes, and nodes to classroom
    await pool.execute(`
      DELETE up FROM user_progress up
      JOIN nodes n ON up.node_id = n.id
      WHERE n.classroom_id = ? AND up.user_id = ?
    `, [classroomId, studentId]);

    await writeAuditLog({
      eventType: 'progress.reset',
      actorUserId: req.user.id,
      targetType: 'user',
      targetId: studentId,
      classroomId: Number(classroomId),
      outcome: 'success',
      req,
    });
    res.json({ message: 'Progress reset successfully' });
  } catch (err) {
    console.error('Error resetting student progress:', err);
    await writeAuditLog({
      eventType: 'progress.reset',
      actorUserId: req.user?.id || null,
      targetType: 'user',
      targetId: req.params.userId,
      classroomId: Number(req.params.id),
      outcome: 'failure',
      req,
      metadata: { reason: 'server_error' },
    });
    res.status(500).json({ error: 'Failed to reset student progress' });
  }
});

export default router;
