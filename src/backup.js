export const BACKUP_FORMAT = 'sudodoku-portable-backup';
export const BACKUP_VERSION = 1;

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function backupChecksum(data) {
  const text = JSON.stringify(data);
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createBackupPayload(data, exportedAt = new Date().toISOString()) {
  const snapshot = JSON.parse(JSON.stringify(data));
  return {
    format:BACKUP_FORMAT,
    version:BACKUP_VERSION,
    appVersion:'v16',
    exportedAt,
    checksum:backupChecksum(snapshot),
    data:snapshot,
  };
}

export function validateBackupPayload(payload) {
  if (!isRecord(payload)) return { ok:false, reason:'shape' };
  if (payload.format !== BACKUP_FORMAT) return { ok:false, reason:'format' };
  if (payload.version !== BACKUP_VERSION) return { ok:false, reason:'version' };
  if (!Number.isFinite(Date.parse(payload.exportedAt))) return { ok:false, reason:'date' };
  if (!isRecord(payload.data) || !isRecord(payload.data.prefs) || !isRecord(payload.data.stats)) return { ok:false, reason:'data' };
  if (payload.data.game !== null && !isRecord(payload.data.game)) return { ok:false, reason:'game' };
  if (payload.checksum !== backupChecksum(payload.data)) return { ok:false, reason:'checksum' };
  return { ok:true, data:JSON.parse(JSON.stringify(payload.data)), exportedAt:payload.exportedAt };
}
