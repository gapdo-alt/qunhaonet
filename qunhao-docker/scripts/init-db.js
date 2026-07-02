import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH ?? path.join(__dirname, '../.data/qunhao.db');
const schemaPath = path.join(__dirname, '../schema.sql');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (!fs.existsSync(dbPath)) {
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(dbPath);
  db.exec(sql);
  db.close();
  console.log('Database initialized:', dbPath);
} else {
  console.log('Database exists:', dbPath);
}
