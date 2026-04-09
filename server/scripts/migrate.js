import { initializeDatabase } from '../db/connection.js';

try {
  await initializeDatabase({ allowSchemaChanges: true });
  console.log('✅ Database migrations completed');
  process.exit(0);
} catch (err) {
  console.error('❌ Database migrations failed:', err);
  process.exit(1);
}
