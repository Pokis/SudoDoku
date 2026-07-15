import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_FORMAT, createBackupPayload, validateBackupPayload } from '../src/backup.js';

const sample = {
  prefs:{ language:'lt', theme:'dark', onboarded:true },
  stats:{ played:42, won:30, achievements:['first-flow'], academyCompleted:['nakedSingle'] },
  game:null,
};

test('portable backups round-trip with an integrity checksum', () => {
  const payload = createBackupPayload(sample, '2026-07-16T10:00:00.000Z');
  assert.equal(payload.format, BACKUP_FORMAT);
  const result = validateBackupPayload(JSON.parse(JSON.stringify(payload)));
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, sample);
});

test('tampered and incompatible backups are rejected', () => {
  const tampered = createBackupPayload(sample, '2026-07-16T10:00:00.000Z');
  tampered.data.stats.played = 999;
  assert.deepEqual(validateBackupPayload(tampered), { ok:false, reason:'checksum' });

  const incompatible = createBackupPayload(sample, '2026-07-16T10:00:00.000Z');
  incompatible.version = 999;
  assert.deepEqual(validateBackupPayload(incompatible), { ok:false, reason:'version' });
});
