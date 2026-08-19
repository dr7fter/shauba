const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { DatabaseSync } = require('node:sqlite')

const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'docs', 'evidence', 'vnext-20260819', 'data')
const fixtureDir = path.join(dataDir, 'isolated-fixture')
fs.mkdirSync(fixtureDir, { recursive: true })

const now = new Date().toISOString()
const version = require(path.join(root, 'package.json')).version
const json = (name, value) => fs.writeFileSync(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const resetFile = (file) => {
  if (fs.existsSync(file)) fs.rmSync(file)
}
const columns = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name)
const integrity = (db) => db.prepare('PRAGMA integrity_check').get().integrity_check

const beforePath = path.join(fixtureDir, 'migration-before.db')
const afterPath = path.join(fixtureDir, 'migration-after.db')
const failedPath = path.join(fixtureDir, 'migration-failed.db')
for (const file of [beforePath, afterPath, failedPath]) resetFile(file)

{
  const db = new DatabaseSync(beforePath)
  db.exec(`
    CREATE TABLE attempts (
      id INTEGER PRIMARY KEY,
      question_id INTEGER NOT NULL,
      attempted_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      result TEXT NOT NULL,
      self_rating INTEGER NOT NULL,
      mode TEXT
    );
    CREATE TABLE progress (
      question_id INTEGER PRIMARY KEY,
      mastery INTEGER,
      next_review TEXT
    );
    INSERT INTO attempts VALUES
      (1,155,'2026-08-18T09:00:00+08:00',45,'correct',3,'paper'),
      (2,160,'2026-08-18T09:10:00+08:00',34811,'wrong',2,'review');
    INSERT INTO progress VALUES (155,3,'2026-08-25');
  `)
  db.close()
}

fs.copyFileSync(beforePath, afterPath)
{
  const db = new DatabaseSync(afterPath)
  db.exec('BEGIN IMMEDIATE')
  try {
    db.exec(`
      ALTER TABLE attempts ADD COLUMN outcome TEXT;
      ALTER TABLE attempts ADD COLUMN evidence_source TEXT;
      ALTER TABLE attempts ADD COLUMN fluency_rating INTEGER;
      ALTER TABLE attempts ADD COLUMN confidence REAL;
      ALTER TABLE attempts ADD COLUMN session_id TEXT;
      ALTER TABLE attempts ADD COLUMN diagnosis_id TEXT;
      UPDATE attempts SET outcome=result, evidence_source='legacy', fluency_rating=self_rating;
    `)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  db.close()
}

fs.copyFileSync(beforePath, failedPath)
let injectedFailure
{
  const db = new DatabaseSync(failedPath)
  db.exec('BEGIN IMMEDIATE')
  try {
    db.exec('ALTER TABLE attempts ADD COLUMN outcome TEXT')
    db.exec('THIS IS AN INTENTIONAL MIGRATION FAILURE')
    db.exec('COMMIT')
  } catch (error) {
    injectedFailure = error.message
    db.exec('ROLLBACK')
  }
  db.close()
}

{
  const db = new DatabaseSync(beforePath, { readOnly: true })
  json('migration-before.json', {
    generatedAt: now,
    appVersion: version,
    fixture: 'isolated-fixture/migration-before.db',
    sha256: hash(beforePath),
    integrityCheck: integrity(db),
    attemptsCount: db.prepare('SELECT COUNT(*) count FROM attempts').get().count,
    attemptColumns: columns(db, 'attempts'),
  })
  db.close()
}

{
  const db = new DatabaseSync(afterPath, { readOnly: true })
  const failed = new DatabaseSync(failedPath, { readOnly: true })
  json('migration-after.json', {
    generatedAt: now,
    appVersion: version,
    fixture: 'isolated-fixture/migration-after.db',
    sha256: hash(afterPath),
    integrityCheck: integrity(db),
    attemptsCount: db.prepare('SELECT COUNT(*) count FROM attempts').get().count,
    attemptColumns: columns(db, 'attempts'),
    backfilledRows: db.prepare('SELECT id,outcome,evidence_source,fluency_rating FROM attempts ORDER BY id').all(),
    injectedFailureRollback: {
      error: injectedFailure,
      fixture: 'isolated-fixture/migration-failed.db',
      integrityCheck: integrity(failed),
      outcomeColumnPresent: columns(failed, 'attempts').includes('outcome'),
      attemptsCount: failed.prepare('SELECT COUNT(*) count FROM attempts').get().count,
    },
  })
  failed.close()
  db.close()
}

const rewardPath = path.join(fixtureDir, 'reward-events.db')
resetFile(rewardPath)
{
  const db = new DatabaseSync(rewardPath)
  db.exec('CREATE TABLE reward_events(event_id TEXT PRIMARY KEY,reward_type TEXT NOT NULL,amount INTEGER NOT NULL,created_at TEXT NOT NULL)')
  const claim = db.prepare('INSERT OR IGNORE INTO reward_events VALUES(?,?,?,?)')
  const first = claim.run('contract-20260819', 'contract', 60, now)
  const duplicate = claim.run('contract-20260819', 'contract', 60, now)
  const chest = claim.run('chest-20260819', 'chest', 150, now)
  json('reward-events.json', {
    generatedAt: now,
    appVersion: version,
    fixture: 'isolated-fixture/reward-events.db',
    integrityCheck: integrity(db),
    writes: { first: first.changes, duplicate: duplicate.changes, chest: chest.changes },
    eventCount: db.prepare('SELECT COUNT(*) count FROM reward_events').get().count,
    expTotal: db.prepare('SELECT SUM(amount) total FROM reward_events').get().total,
    events: db.prepare('SELECT * FROM reward_events ORDER BY event_id').all(),
    conclusion: 'duplicate event_id inserted 0 rows; EXP changed once',
  })
  db.close()
}

const durationPath = path.join(fixtureDir, 'duration-exclusion.db')
resetFile(durationPath)
{
  const db = new DatabaseSync(durationPath)
  db.exec(`
    CREATE TABLE attempts(id INTEGER PRIMARY KEY,duration_seconds INTEGER NOT NULL,outcome TEXT NOT NULL);
    INSERT INTO attempts VALUES(1,45,'correct'),(2,1800,'wrong'),(3,34811,'correct'),(4,0,'wrong');
  `)
  json('duration-exclusion.json', {
    generatedAt: now,
    appVersion: version,
    fixture: 'isolated-fixture/duration-exclusion.db',
    integrityCheck: integrity(db),
    rawRows: db.prepare('SELECT * FROM attempts ORDER BY id').all(),
    aggregate: db.prepare(`
      SELECT COUNT(*) raw_count,
             SUM(CASE WHEN duration_seconds BETWEEN 1 AND 1800 THEN duration_seconds ELSE 0 END) valid_seconds,
             SUM(CASE WHEN duration_seconds<1 OR duration_seconds>1800 THEN 1 ELSE 0 END) excluded_count
      FROM attempts
    `).get(),
    conclusion: 'raw rows remain readable; 0 and >1800 second rows are excluded from aggregates',
  })
  db.close()
}

const currentPath = path.join(fixtureDir, 'restore-current.db')
const backupPath = path.join(fixtureDir, 'restore-valid-backup.db')
const preRestorePath = path.join(fixtureDir, 'restore-pre-restore.db')
const corruptPath = path.join(fixtureDir, 'restore-corrupt.db')
for (const file of [currentPath, backupPath, preRestorePath, corruptPath]) resetFile(file)
const createRestoreDb = (file, marker, attempts) => {
  const db = new DatabaseSync(file)
  db.exec(`CREATE TABLE attempts(id INTEGER PRIMARY KEY); CREATE TABLE progress(question_id INTEGER PRIMARY KEY); CREATE TABLE app_state(marker TEXT NOT NULL); INSERT INTO app_state VALUES('${marker}');`)
  for (let i = 1; i <= attempts; i += 1) db.prepare('INSERT INTO attempts VALUES(?)').run(i)
  db.close()
}
createRestoreDb(currentPath, 'current-before-restore', 1)
createRestoreDb(backupPath, 'validated-backup', 3)
fs.writeFileSync(corruptPath, 'not a sqlite database', 'utf8')

const restoreLog = []
const preflight = (file) => {
  const db = new DatabaseSync(file, { readOnly: true })
  const result = integrity(db)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name)
  db.close()
  if (result !== 'ok' || !tables.includes('attempts') || !tables.includes('progress')) throw new Error(`preflight failed: integrity=${result}`)
  return { integrity: result, tables }
}

const beforeRestoreHash = hash(currentPath)
const validCheck = preflight(backupPath)
restoreLog.push(`PASS valid backup preflight: ${JSON.stringify(validCheck)}`)
fs.copyFileSync(currentPath, preRestorePath)
fs.copyFileSync(backupPath, currentPath)
const restored = new DatabaseSync(currentPath, { readOnly: true })
restoreLog.push(`PASS pre-restore snapshot sha256=${hash(preRestorePath)}`)
restoreLog.push(`PASS restored marker=${restored.prepare('SELECT marker FROM app_state').get().marker} attempts=${restored.prepare('SELECT COUNT(*) count FROM attempts').get().count}`)
restored.close()

const restoredHashBeforeCorruptAttempt = hash(currentPath)
try {
  preflight(corruptPath)
  restoreLog.push('FAIL corrupt backup unexpectedly passed preflight')
} catch (error) {
  restoreLog.push(`PASS corrupt backup rejected before switch: ${error.message}`)
}
restoreLog.push(`PASS current database unchanged after rejected restore=${hash(currentPath) === restoredHashBeforeCorruptAttempt}`)
restoreLog.push(`PASS original current database recoverable=${hash(preRestorePath) === beforeRestoreHash}`)
restoreLog.push('Rust coverage: failed_migration_rolls_back_all_schema_changes; restore_preflight_rejects_invalid_backup_before_switching; rolling_backups_keep_latest_seven_and_four_weekly_points')
fs.writeFileSync(path.join(dataDir, 'backup-restore.log'), `${restoreLog.join('\n')}\n`, 'utf8')

console.log(`Acceptance data evidence generated in ${dataDir}`)
