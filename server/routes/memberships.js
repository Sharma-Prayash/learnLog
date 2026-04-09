import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { sendJoinRequestEmail, sendApprovalEmail } from '../services/emailService.js';
import { writeAuditLog } from '../services/auditLog.js';

const router = Router();

router.use(authenticate);

// POST /api/memberships/join — join a classroom via invite code
router.post('/join', async (req, res) => {
  try {
    const { invite_code } = req.body;

    if (!invite_code) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    // Find the classroom
    const [classrooms] = await pool.execute(
      'SELECT id, name, owner_id FROM classrooms WHERE invite_code = ?',
      [invite_code.toUpperCase()]
    );

    if (classrooms.length === 0) {
      await writeAuditLog({
        eventType: 'membership.join',
        actorUserId: req.user.id,
        outcome: 'failure',
        req,
        metadata: { reason: 'invalid_invite_code' },
      });
      return res.status(404).json({ error: 'Invalid invite code. No classroom found.' });
    }

    const classroom = classrooms[0];

    // Can't join your own classroom as a student
    if (classroom.owner_id === req.user.id) {
      await writeAuditLog({
        eventType: 'membership.join',
        actorUserId: req.user.id,
        classroomId: classroom.id,
        outcome: 'denied',
        req,
        metadata: { reason: 'owner_cannot_join_as_student' },
      });
      return res.status(400).json({ error: 'You are the owner of this classroom' });
    }

    // Check if already a member
    const [existing] = await pool.execute(
      'SELECT id, status FROM memberships WHERE user_id = ? AND classroom_id = ?',
      [req.user.id, classroom.id]
    );

    if (existing.length > 0) {
      const membership = existing[0];
      if (membership.status === 'approved') {
        return res.status(400).json({ error: 'You are already a member of this classroom' });
      }
      if (membership.status === 'pending') {
        return res.status(400).json({ error: 'Your join request is already pending approval' });
      }
      if (membership.status === 'rejected') {
        // Allow re-request after rejection
        await pool.execute(
          "UPDATE memberships SET status = 'pending', created_at = NOW() WHERE id = ?",
          [membership.id]
        );

        // Send email notification to owner
        try {
          const [ownerRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [classroom.owner_id]);
          const [studentRows] = await pool.execute('SELECT username FROM users WHERE id = ?', [req.user.id]);
          if (ownerRows.length > 0) {
            await sendJoinRequestEmail(ownerRows[0].email, studentRows[0]?.username || 'A student', classroom.name);
          }
        } catch (emailErr) {
          console.warn('Failed to send join request email:', emailErr.message);
        }

        await writeAuditLog({
          eventType: 'membership.join',
          actorUserId: req.user.id,
          targetType: 'membership',
          targetId: membership.id,
          classroomId: classroom.id,
          outcome: 'success',
          req,
          metadata: { status: 'pending', action: 'resubmitted' },
        });
        return res.json({ message: `Join request re-submitted for "${classroom.name}". Waiting for approval.` });
      }
    }

    // Create pending membership
    await pool.execute(
      "INSERT INTO memberships (user_id, classroom_id, role, status) VALUES (?, ?, 'student', 'pending')",
      [req.user.id, classroom.id]
    );

    // Send email notification to owner
    try {
      const [ownerRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [classroom.owner_id]);
      const [studentRows] = await pool.execute('SELECT username FROM users WHERE id = ?', [req.user.id]);
      if (ownerRows.length > 0) {
        await sendJoinRequestEmail(ownerRows[0].email, studentRows[0]?.username || 'A student', classroom.name);
      }
    } catch (emailErr) {
      console.warn('Failed to send join request email:', emailErr.message);
    }

    await writeAuditLog({
      eventType: 'membership.join',
      actorUserId: req.user.id,
      targetType: 'classroom',
      targetId: classroom.id,
      classroomId: classroom.id,
      outcome: 'success',
      req,
      metadata: { status: 'pending', action: 'created' },
    });

    res.status(201).json({
      message: `Join request submitted for "${classroom.name}". Waiting for admin approval.`,
      classroom_name: classroom.name,
    });
  } catch (err) {
    console.error('Error joining classroom:', err);
    await writeAuditLog({
      eventType: 'membership.join',
      actorUserId: req.user?.id || null,
      outcome: 'failure',
      req,
      metadata: { reason: 'server_error' },
    });
    res.status(500).json({ error: 'Failed to join classroom' });
  }
});

// PUT /api/memberships/:id/approve — approve a pending request (owner only)
router.put('/:id/approve', async (req, res) => {
  try {
    const membershipId = req.params.id;

    // Get the membership + classroom to verify owner
    const [memberships] = await pool.execute(`
      SELECT m.*, c.owner_id, c.name AS classroom_name
      FROM memberships m 
      JOIN classrooms c ON m.classroom_id = c.id 
      WHERE m.id = ?
    `, [membershipId]);

    if (memberships.length === 0) {
      await writeAuditLog({
        eventType: 'membership.approve',
        actorUserId: req.user.id,
        targetType: 'membership',
        targetId: membershipId,
        outcome: 'failure',
        req,
        metadata: { reason: 'not_found' },
      });
      return res.status(404).json({ error: 'Membership not found' });
    }

    const membership = memberships[0];

    if (membership.owner_id !== req.user.id) {
      await writeAuditLog({
        eventType: 'membership.approve',
        actorUserId: req.user.id,
        targetType: 'membership',
        targetId: membershipId,
        classroomId: membership.classroom_id,
        outcome: 'denied',
        req,
        metadata: { reason: 'owner_required' },
      });
      return res.status(403).json({ error: 'Only the classroom owner can approve requests' });
    }

    if (membership.status !== 'pending') {
      await writeAuditLog({
        eventType: 'membership.approve',
        actorUserId: req.user.id,
        targetType: 'membership',
        targetId: membershipId,
        classroomId: membership.classroom_id,
        outcome: 'failure',
        req,
        metadata: { reason: 'invalid_status', status: membership.status },
      });
      return res.status(400).json({ error: `Cannot approve – status is already "${membership.status}"` });
    }

    await pool.execute("UPDATE memberships SET status = 'approved' WHERE id = ?", [membershipId]);

    // Send approval email to student
    try {
      const [studentRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [membership.user_id]);
      if (studentRows.length > 0) {
        await sendApprovalEmail(studentRows[0].email, membership.classroom_name);
      }
    } catch (emailErr) {
      console.warn('Failed to send approval email:', emailErr.message);
    }

    await writeAuditLog({
      eventType: 'membership.approve',
      actorUserId: req.user.id,
      targetType: 'membership',
      targetId: membershipId,
      classroomId: membership.classroom_id,
      outcome: 'success',
      req,
      metadata: { approvedUserId: membership.user_id },
    });

    res.json({ message: 'Student approved successfully' });
  } catch (err) {
    console.error('Error approving membership:', err);
    await writeAuditLog({
      eventType: 'membership.approve',
      actorUserId: req.user?.id || null,
      targetType: 'membership',
      targetId: req.params.id,
      outcome: 'failure',
      req,
      metadata: { reason: 'server_error' },
    });
    res.status(500).json({ error: 'Failed to approve membership' });
  }
});

// PUT /api/memberships/:id/reject — reject a pending request (owner only)
router.put('/:id/reject', async (req, res) => {
  try {
    const membershipId = req.params.id;

    const [memberships] = await pool.execute(`
      SELECT m.*, c.owner_id 
      FROM memberships m 
      JOIN classrooms c ON m.classroom_id = c.id 
      WHERE m.id = ?
    `, [membershipId]);

    if (memberships.length === 0) {
      await writeAuditLog({
        eventType: 'membership.reject',
        actorUserId: req.user.id,
        targetType: 'membership',
        targetId: membershipId,
        outcome: 'failure',
        req,
        metadata: { reason: 'not_found' },
      });
      return res.status(404).json({ error: 'Membership not found' });
    }

    if (memberships[0].owner_id !== req.user.id) {
      await writeAuditLog({
        eventType: 'membership.reject',
        actorUserId: req.user.id,
        targetType: 'membership',
        targetId: membershipId,
        classroomId: memberships[0].classroom_id,
        outcome: 'denied',
        req,
        metadata: { reason: 'owner_required' },
      });
      return res.status(403).json({ error: 'Only the classroom owner can reject requests' });
    }

    await pool.execute("UPDATE memberships SET status = 'rejected' WHERE id = ?", [membershipId]);
    await writeAuditLog({
      eventType: 'membership.reject',
      actorUserId: req.user.id,
      targetType: 'membership',
      targetId: membershipId,
      classroomId: memberships[0].classroom_id,
      outcome: 'success',
      req,
      metadata: { rejectedUserId: memberships[0].user_id },
    });
    res.json({ message: 'Student rejected' });
  } catch (err) {
    console.error('Error rejecting membership:', err);
    await writeAuditLog({
      eventType: 'membership.reject',
      actorUserId: req.user?.id || null,
      targetType: 'membership',
      targetId: req.params.id,
      outcome: 'failure',
      req,
      metadata: { reason: 'server_error' },
    });
    res.status(500).json({ error: 'Failed to reject membership' });
  }
});

export default router;
