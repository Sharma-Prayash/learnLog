import mysql from 'mysql2/promise';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomInt, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { getBooleanEnv, isProductionEnv } from '../security/env.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'learnlog',
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: false,
});

/**
 * Initialize the database: create DB, tables, and seed data.
 * Uses a separate connection (without database selected) to run CREATE DATABASE.
 */
export async function initializeDatabase({ allowSchemaChanges = shouldRunSchemaChangesOnStartup() } = {}) {
  if (!allowSchemaChanges) {
    await verifyRuntimeDatabase();
    console.log('✅ Database connection verified without schema changes');
    return;
  }

  const initConnection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = await readFile(schemaPath, 'utf-8');
    await initConnection.query(schema);
    await migrateExistingSchema(initConnection);
    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    throw err;
  } finally {
    await initConnection.end();
  }
}

async function migrateExistingSchema(connection) {
  await migrateUsersTable(connection);
  await migrateClassroomsTable(connection);
  await migrateNodesTable(connection);
}

function shouldRunSchemaChangesOnStartup() {
  return getBooleanEnv('DB_AUTO_MIGRATE', !isProductionEnv());
}

async function verifyRuntimeDatabase() {
  const connection = await pool.getConnection();

  try {
    await connection.query('SELECT 1');
    await verifyRequiredTables(connection);
  } finally {
    connection.release();
  }
}

async function verifyRequiredTables(connection) {
  const requiredTables = [
    'users',
    'classrooms',
    'memberships',
    'nodes',
    'user_progress',
    'announcements',
    'lesson_comments',
    'doubts',
    'doubt_replies',
    'audit_logs',
  ];

  const placeholders = requiredTables.map(() => '?').join(', ');
  const [rows] = await connection.execute(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name IN (${placeholders})
    `,
    requiredTables
  );

  const existingTables = new Set(rows.map((row) => row.table_name));
  const missingTables = requiredTables.filter((tableName) => !existingTables.has(tableName));

  if (missingTables.length > 0) {
    throw new Error(
      `Database schema is incomplete. Missing table(s): ${missingTables.join(', ')}. Run "npm run migrate" in server/ before starting the API.`
    );
  }
}

async function migrateUsersTable(connection) {
  if (!(await columnExists(connection, 'users', 'email'))) {
    await connection.query('ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL AFTER username');
  }

  await connection.query(`
    UPDATE users
    SET email = CONCAT('legacy-user-', id, '@local.invalid')
    WHERE email IS NULL OR email = ''
  `);

  if (!(await uniqueIndexExists(connection, 'users', 'email'))) {
    await connection.query('ALTER TABLE users ADD UNIQUE KEY email (email)');
  }

  await connection.query('ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NOT NULL');

  if (!(await columnExists(connection, 'users', 'password_hash'))) {
    await connection.query('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER email');
  }

  const lockedPasswordHash = await bcrypt.hash(randomUUID(), 10);
  await connection.execute(
    'UPDATE users SET password_hash = ? WHERE password_hash IS NULL OR password_hash = ?',
    [lockedPasswordHash, '']
  );
  await connection.query('ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL');

  if (!(await uniqueIndexExists(connection, 'users', 'username'))) {
    const [duplicates] = await connection.query(`
      SELECT username, COUNT(*) AS total
      FROM users
      GROUP BY username
      HAVING total > 1
      LIMIT 1
    `);

    if (duplicates.length === 0) {
      await connection.query('ALTER TABLE users ADD UNIQUE KEY username (username)');
    }
  }
}

async function migrateClassroomsTable(connection) {
  if (await columnExists(connection, 'classrooms', 'invite_code')) {
    await connection.query('ALTER TABLE classrooms MODIFY COLUMN invite_code VARCHAR(12) NOT NULL');
  }
}

async function migrateNodesTable(connection) {
  if (await columnExists(connection, 'nodes', 'course_id')) {
    await connection.query('ALTER TABLE nodes MODIFY COLUMN course_id INT NULL');
  }

  if (!(await columnExists(connection, 'nodes', 'classroom_id'))) {
    await connection.query('ALTER TABLE nodes ADD COLUMN classroom_id INT NULL AFTER id');

    if (await tableExists(connection, 'courses')) {
      await migrateLegacyCourseNodes(connection);
    }
  }

  const [orphanNodes] = await connection.query(
    'SELECT COUNT(*) AS total FROM nodes WHERE classroom_id IS NULL'
  );

  if (orphanNodes[0].total > 0) {
    throw new Error(
      `Cannot migrate nodes.classroom_id automatically: ${orphanNodes[0].total} node(s) have no classroom mapping`
    );
  }

  await connection.query('ALTER TABLE nodes MODIFY COLUMN classroom_id INT NOT NULL');

  if (!(await indexExists(connection, 'nodes', 'classroom_id'))) {
    await connection.query('ALTER TABLE nodes ADD INDEX classroom_id (classroom_id)');
  }

  if (!(await foreignKeyExists(connection, 'nodes', 'nodes_classrooms_fk'))) {
    await connection.query(`
      ALTER TABLE nodes
      ADD CONSTRAINT nodes_classrooms_fk
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
    `);
  }
}

async function migrateLegacyCourseNodes(connection) {
  const [courses] = await connection.query(`
    SELECT DISTINCT c.id, c.user_id, c.title
    FROM courses c
    JOIN nodes n ON n.course_id = c.id
    WHERE n.classroom_id IS NULL
  `);

  for (const course of courses) {
    const [existingClassrooms] = await connection.execute(
      'SELECT id FROM classrooms WHERE owner_id = ? AND name = ? LIMIT 1',
      [course.user_id, course.title]
    );

    let classroomId = existingClassrooms[0]?.id;

    if (!classroomId) {
      const inviteCode = await generateUniqueInviteCode(connection);
      const [created] = await connection.execute(
        'INSERT INTO classrooms (name, description, owner_id, invite_code) VALUES (?, ?, ?, ?)',
        [course.title, 'Migrated from legacy course data.', course.user_id, inviteCode]
      );
      classroomId = created.insertId;

      await connection.execute(
        "INSERT IGNORE INTO memberships (user_id, classroom_id, role, status) VALUES (?, ?, 'teacher', 'approved')",
        [course.user_id, classroomId]
      );
    }

    await connection.execute(
      'UPDATE nodes SET classroom_id = ? WHERE course_id = ? AND classroom_id IS NULL',
      [classroomId, course.id]
    );
  }
}

async function generateUniqueInviteCode(connection) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = createInviteCode();
    const [existing] = await connection.execute(
      'SELECT id FROM classrooms WHERE invite_code = ?',
      [code]
    );
    if (existing.length === 0) return code;
  }

  throw new Error('Failed to generate a unique invite code during migration');
}

function createInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars[randomInt(chars.length)];
  }
  return code;
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?
    `,
    [tableName]
  );
  return rows[0].total > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
    `,
    [tableName, columnName]
  );
  return rows[0].total > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
    `,
    [tableName, indexName]
  );
  return rows[0].total > 0;
}

async function uniqueIndexExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
        AND non_unique = 0
    `,
    [tableName, columnName]
  );
  return rows[0].total > 0;
}

async function foreignKeyExists(connection, tableName, constraintName) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.table_constraints
      WHERE constraint_schema = DATABASE()
        AND table_name = ?
        AND constraint_name = ?
        AND constraint_type = 'FOREIGN KEY'
    `,
    [tableName, constraintName]
  );
  return rows[0].total > 0;
}

export default pool;
