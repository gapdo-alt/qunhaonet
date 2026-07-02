import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export interface PreparedStatement {
  bind(...args: unknown[]): PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<void>;
}

export interface AppDatabase {
  prepare(sql: string): PreparedStatement;
  close(): void;
}

class Stmt implements PreparedStatement {
  private args: unknown[] = [];

  constructor(
    private readonly stmt: Database.Statement,
  ) {}

  bind(...args: unknown[]): PreparedStatement {
    this.args = args;
    return this;
  }

  async first<T>(): Promise<T | null> {
    const row = this.stmt.get(...this.args) as T | undefined;
    return row ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const results = this.stmt.all(...this.args) as T[];
    return { results };
  }

  async run(): Promise<void> {
    this.stmt.run(...this.args);
  }
}

export function openDatabase(dbPath: string, schemaPath: string): AppDatabase {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  const isNew = !fs.existsSync(dbPath);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  if (isNew) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(sql);
  }

  return {
    prepare(sql: string): PreparedStatement {
      return new Stmt(db.prepare(sql));
    },
    close() {
      db.close();
    },
  };
}
