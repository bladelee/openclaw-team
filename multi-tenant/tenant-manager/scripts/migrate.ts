#!/usr/bin/env tsx
/**
 * Migration Runner
 *
 * Runs all SQL migration files in order from the migrations directory.
 *
 * Usage:
 *   pnpm db:migrate
 */

import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { config } from '../src/config.js';

// Migration record table
const MIGRATIONS_TABLE = 'schema_migrations';

async function createMigrationsTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function getExecutedMigrations(pool: Pool): Promise<string[]> {
  const result = await pool.query(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`);
  return result.rows.map((row: any) => row.name);
}

async function markMigrationExecuted(pool: Pool, name: string) {
  await pool.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [name]);
}

async function runMigration(pool: Pool, migrationFile: string) {
  const migrationPath = join('migrations', migrationFile);
  console.log(`\n📄 Running migration: ${migrationFile}`);

  const sql = readFileSync(migrationPath, 'utf-8');

  try {
    // Split by semicolon and run each statement
    // Note: This is a simple approach. For complex migrations, you might need a proper SQL parser.
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }

    await markMigrationExecuted(pool, migrationFile);
    console.log(`✅ Migration completed: ${migrationFile}`);
  } catch (error) {
    console.error(`❌ Migration failed: ${migrationFile}`, error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting database migrations...\n');

  const pool = new Pool({
    connectionString: config.DATABASE_URL,
  });

  try {
    // Create migrations tracking table
    await createMigrationsTable(pool);
    console.log('✅ Migrations table ready');

    // Get all migration files
    const migrationsDir = 'migrations';
    const migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`\n📋 Found ${migrationFiles.length} migration file(s)`);

    // Get executed migrations
    const executedMigrations = await getExecutedMigrations(pool);
    console.log(`✅ Already executed: ${executedMigrations.length} migration(s)`);

    // Run pending migrations
    let executedCount = 0;
    for (const file of migrationFiles) {
      if (!executedMigrations.includes(file)) {
        await runMigration(pool, file);
        executedCount++;
      } else {
        console.log(`⊘ Skipping already executed: ${file}`);
      }
    }

    console.log(`\n✨ Migration complete! Executed ${executedCount} new migration(s).`);

    if (executedCount === 0) {
      console.log('💡 Database is up to date.');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
