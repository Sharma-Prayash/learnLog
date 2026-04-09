import pool from '../db/connection.js';

export async function writeAuditLog({
  eventType,
  actorUserId = null,
  targetType = null,
  targetId = null,
  classroomId = null,
  outcome = 'success',
  req = null,
  metadata = null,
}) {
  const payload = {
    eventType,
    actorUserId,
    targetType,
    targetId: targetId == null ? null : String(targetId),
    classroomId,
    outcome,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    metadata: metadata == null ? null : JSON.stringify(sanitizeMetadata(metadata)),
  };

  try {
    await pool.execute(
      `INSERT INTO audit_logs
        (event_type, actor_user_id, target_type, target_id, classroom_id, outcome, ip_address, user_agent, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.eventType,
        payload.actorUserId,
        payload.targetType,
        payload.targetId,
        payload.classroomId,
        payload.outcome,
        payload.ipAddress,
        payload.userAgent,
        payload.metadata,
      ]
    );
  } catch (err) {
    console.warn('Audit log write failed:', err.message, payload);
  }
}

function getClientIp(req) {
  if (!req) return null;

  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim().slice(0, 64);
  }

  return (req.ip || req.socket?.remoteAddress || null)?.slice(0, 64) || null;
}

function getUserAgent(req) {
  if (!req) return null;
  const value = req.get?.('user-agent') || req.headers['user-agent'];
  return typeof value === 'string' ? value.slice(0, 255) : null;
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > 4) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 497)}...` : value;

  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeMetadata(item, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 25)
        .map(([key, item]) => [key, sanitizeMetadata(item, depth + 1)])
    );
  }

  return String(value);
}
