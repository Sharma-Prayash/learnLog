import { Router } from 'express';
import multer from 'multer';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { uploadToS3 } from '../services/s3.js';
import { scanUploadedFile } from '../services/malwareScanner.js';
import { writeAuditLog } from '../services/auditLog.js';
import { validateRelativePath, validateUploadedFile } from '../security/uploadPolicy.js';

const router = Router();
const maxFiles = Number(process.env.UPLOAD_MAX_FILES || 100);
const maxFileSizeMb = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB || 50);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: maxFiles,
    fileSize: maxFileSizeMb * 1024 * 1024,
    fieldSize: 1024 * 1024,
  },
});
const uploadFiles = upload.array('files', maxFiles);

router.use(authenticate);

/**
 * POST /api/upload
 * Accepts multipart form data with:
 *   - files: array of files
 *   - paths: JSON array of relative paths (webkitRelativePath)
 *   - classroomId: the classroom to attach files to
 * Only the classroom owner can upload.
 */
router.post('/', handleUpload, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { classroomId } = req.body;
    let paths = req.body.paths;

    if (!classroomId || !paths || !req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'classroomId, paths, and files are required' });
    }

    // Verify ownership
    const [classroom] = await connection.execute(
      'SELECT name, owner_id FROM classrooms WHERE id = ?',
      [classroomId]
    );

    if (classroom.length === 0) {
      await writeAuditLog({
        eventType: 'upload.create',
        actorUserId: req.user.id,
        targetType: 'classroom',
        targetId: classroomId,
        outcome: 'failure',
        req,
        metadata: { reason: 'classroom_not_found' },
      });
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classroom[0].owner_id !== req.user.id) {
      await writeAuditLog({
        eventType: 'upload.create',
        actorUserId: req.user.id,
        targetType: 'classroom',
        targetId: classroomId,
        classroomId: Number(classroomId),
        outcome: 'denied',
        req,
        metadata: { reason: 'owner_required' },
      });
      return res.status(403).json({ error: 'Only the classroom owner can upload content' });
    }

    const classroomName = classroom[0].name;

    // Parse paths if sent as JSON string
    if (typeof paths === 'string') {
      try {
        paths = JSON.parse(paths);
      } catch {
        return res.status(400).json({ error: 'paths must be a valid JSON array' });
      }
    }

    if (!Array.isArray(paths) || paths.length !== req.files.length) {
      return res.status(400).json({ error: 'paths must match the uploaded files' });
    }

    const folderMap = new Map();
    const results = [];

    // Optional: upload into a specific parent folder
    const baseParentId = req.body.parentId ? parseInt(req.body.parentId, 10) : null;

    if (req.body.parentId && Number.isNaN(baseParentId)) {
      return res.status(400).json({ error: 'parentId must be a valid node id' });
    }

    if (baseParentId) {
      const [parentRows] = await connection.execute(
        "SELECT id FROM nodes WHERE id = ? AND classroom_id = ? AND type = 'folder'",
        [baseParentId, classroomId]
      );

      if (parentRows.length === 0) {
        return res.status(400).json({ error: 'parentId must be a folder in this classroom' });
      }
    }

    const normalizedPaths = [];
    const uploadedExtensions = [];

    for (let i = 0; i < paths.length; i++) {
      const file = req.files[i];
      const pathValidation = validateRelativePath(paths[i]);

      if (!pathValidation.valid) {
        await writeAuditLog({
          eventType: 'upload.create',
          actorUserId: req.user.id,
          targetType: 'classroom',
          targetId: classroomId,
          classroomId: Number(classroomId),
          outcome: 'failure',
          req,
          metadata: { reason: 'invalid_path', fileName: file?.originalname, index: i },
        });
        return res.status(400).json({ error: pathValidation.error });
      }

      const fileValidation = validateUploadedFile(file);
      if (!fileValidation.valid) {
        await writeAuditLog({
          eventType: 'upload.create',
          actorUserId: req.user.id,
          targetType: 'classroom',
          targetId: classroomId,
          classroomId: Number(classroomId),
          outcome: 'failure',
          req,
          metadata: { reason: 'blocked_file_type', fileName: file?.originalname, mimetype: file?.mimetype, index: i },
        });
        return res.status(415).json({ error: fileValidation.error });
      }

      try {
        const scanResult = await scanUploadedFile(file);
        if (!scanResult.clean) {
          await writeAuditLog({
            eventType: 'upload.create',
            actorUserId: req.user.id,
            targetType: 'classroom',
            targetId: classroomId,
            classroomId: Number(classroomId),
            outcome: 'failure',
            req,
            metadata: { reason: 'malware_detected', fileName: file.originalname, index: i },
          });
          return res.status(422).json({ error: `Upload blocked for "${file.originalname}" by malware scanning` });
        }
      } catch (scanErr) {
        await writeAuditLog({
          eventType: 'upload.create',
          actorUserId: req.user.id,
          targetType: 'classroom',
          targetId: classroomId,
          classroomId: Number(classroomId),
          outcome: 'failure',
          req,
          metadata: { reason: 'scanner_unavailable', message: scanErr.message, fileName: file?.originalname, index: i },
        });
        return res.status(503).json({ error: 'Malware scanning is unavailable. Please try again later.' });
      }

      normalizedPaths.push(pathValidation.normalizedPath);
      uploadedExtensions.push(fileValidation.extension);
    }

    paths = normalizedPaths;

    await connection.beginTransaction();

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const relativePath = paths[i];
      const segments = relativePath.split('/').filter(Boolean);

      // Build folder hierarchy starting from baseParentId
      let parentId = baseParentId;

      for (let j = 0; j < segments.length - 1; j++) {
        const folderPath = segments.slice(0, j + 1).join('/');
        const folderName = segments[j];

        if (folderMap.has(folderPath)) {
          parentId = folderMap.get(folderPath);
        } else {
          const [existing] = await connection.execute(
            `SELECT id FROM nodes WHERE classroom_id = ? AND name = ? AND type = 'folder' AND ${
              parentId === null ? 'parent_id IS NULL' : 'parent_id = ?'
            }`,
            parentId === null
              ? [classroomId, folderName]
              : [classroomId, folderName, parentId]
          );

          if (existing.length > 0) {
            parentId = existing[0].id;
            folderMap.set(folderPath, parentId);
          } else {
            const [insertResult] = await connection.execute(
              'INSERT INTO nodes (classroom_id, name, type, parent_id) VALUES (?, ?, ?, ?)',
              [classroomId, folderName, 'folder', parentId]
            );
            parentId = insertResult.insertId;
            folderMap.set(folderPath, parentId);
          }
        }
      }

      // Upload file to S3
      const fileName = segments[segments.length - 1];
      const s3Key = `classrooms/${req.user.id}/${classroomName}/${relativePath}`;

      let resourceUrl = null;
      try {
        resourceUrl = await uploadToS3(file.buffer, s3Key, file.mimetype);
      } catch (s3Err) {
        console.warn(`⚠️  S3 upload failed for ${fileName}:`, s3Err.message);
        resourceUrl = null;
      }

      // Insert file node
      const [fileResult] = await connection.execute(
        'INSERT INTO nodes (classroom_id, name, type, parent_id, resource_url) VALUES (?, ?, ?, ?, ?)',
        [classroomId, fileName, 'file', parentId, resourceUrl]
      );

      results.push({
        id: fileResult.insertId,
        name: fileName,
        resource_url: resourceUrl,
      });
    }

    await connection.commit();

    await writeAuditLog({
      eventType: 'upload.create',
      actorUserId: req.user.id,
      targetType: 'classroom',
      targetId: classroomId,
      classroomId: Number(classroomId),
      outcome: 'success',
      req,
      metadata: {
        fileCount: results.length,
        parentId: baseParentId,
        extensions: [...new Set(uploadedExtensions)],
      },
    });

    res.status(201).json({
      message: `${results.length} file(s) uploaded successfully`,
      files: results,
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error during upload:', err);
    await writeAuditLog({
      eventType: 'upload.create',
      actorUserId: req.user?.id || null,
      targetType: 'classroom',
      targetId: req.body.classroomId || null,
      classroomId: Number(req.body.classroomId) || null,
      outcome: 'failure',
      req,
      metadata: { reason: 'server_error' },
    });
    res.status(500).json({ error: 'Upload failed' });
  } finally {
    connection.release();
  }
});

function handleUpload(req, res, next) {
  uploadFiles(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `Each file must be ${maxFileSizeMb}MB or smaller` });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(413).json({ error: `Upload at most ${maxFiles} files at a time` });
      }
      return res.status(400).json({ error: err.message });
    }

    if (err) return next(err);
    return next();
  });
}

export default router;
