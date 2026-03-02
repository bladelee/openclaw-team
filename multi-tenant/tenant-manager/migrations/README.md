# Database Migrations

This directory contains SQL migration files for the tenant-manager database.

## Running Migrations

### First Time Setup

Before running the tenant-manager service for the first time, run migrations:

```bash
cd /path/to/tenant-manager
pnpm db:migrate
```

### After Updating

After pulling new code that includes database changes:

```bash
pnpm db:migrate
```

### In Production

For production deployments, migrations should be run **before** starting the new version of the service:

```bash
# 1. Pull new code
git pull

# 2. Install dependencies
pnpm install

# 3. Run migrations
pnpm db:migrate

# 4. Restart the service
pnpm start
```

## Migration Files

Migration files are SQL files that are executed in alphabetical order:

- `002_instances.sql` - Creates the instances table and host_cache table
- `003_add_custom_instance_fields.sql` - Adds support for custom and hardware instances

## How It Works

The migration runner (`scripts/migrate.ts`):

1. Creates a `schema_migrations` table to track executed migrations
2. Reads all `*.sql` files from the migrations directory
3. Skips migrations that have already been executed
4. Executes pending migrations in order
5. Marks each migration as executed after successful completion

## Adding New Migrations

When you need to modify the database schema:

1. Create a new SQL file with a higher number prefix:
   ```
   migrations/004_your_feature_name.sql
   ```

2. Use `IF NOT EXISTS` clauses for safety:
   ```sql
   ALTER TABLE instances ADD COLUMN IF NOT EXISTS new_field TEXT;
   ```

3. Test the migration locally:
   ```bash
   pnpm db:migrate
   ```

4. Commit the migration file

## Troubleshooting

### Migration Failed

If a migration fails:

1. Check the error message
2. Fix the SQL in the migration file
3. The migration will be retried on the next run (unless it was partially executed)

### Forcing Re-run

If you need to re-run a migration:

```sql
-- Delete the migration record
DELETE FROM schema_migrations WHERE name = '003_add_custom_instance_fields.sql';

-- Then run migrations again
pnpm db:migrate
```

### Database Already Has Tables

If you manually created tables before migrations were set up:

1. The migrations will use `IF NOT EXISTS` and should work
2. Or you can manually insert the migration records:
   ```sql
   INSERT INTO schema_migrations (name) VALUES
     ('002_instances.sql'),
     ('003_add_custom_instance_fields.sql');
   ```

## Important Notes

- **Always run migrations before starting the service**
- **Never modify existing migration files** - create new ones instead
- **Test migrations in development first**
- **Back up production database before running migrations**
- **Use transaction-safe SQL** (one statement per migration is recommended)
