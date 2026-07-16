import test from 'node:test';
import assert from 'node:assert/strict';
import { ACADEMY_LESSONS } from '../src/academy.js';
import { createSeededRandom, generatePuzzle } from '../src/sudoku.js';
import { calculateRatingUpdate, createPracticePlan, decodeChallenge, decodeProgressSnapshot, encodeChallenge, encodeProgressSnapshot, gradePuzzleByTechniques, recordPracticeEvent } from '../src/premium.js';
import { createQrMatrix } from '../src/qr.js';

const ACHIEVEMENT_IDS = Array.from({ length:40 }, (_, index) => `achievement-${index}`);

test('technique grading produces a stable logical profile', () => {
  const generated = generatePuzzle('hard', createSeededRandom('premium-grade'));
  const grade = gradePuzzleByTechniques(generated.puzzle, generated.solution);
  assert.ok(['foundation','intermediate','advanced','expert','grandmaster'].includes(grade.label));
  assert.ok(grade.steps > 0);
  assert.ok(grade.score >= 20 && grade.score <= 100);
});

test('adaptive rating rewards a strong win and penalizes a loss', () => {
  const grade = { label:'advanced' };
  const win = calculateRatingUpdate(1000, { won:true, difficulty:'hard', grade, mistakes:0, hints:0, seconds:500 });
  const loss = calculateRatingUpdate(1000, { won:false, difficulty:'hard', grade, mistakes:3, hints:0, seconds:500 });
  assert.ok(win.after > 1000);
  assert.ok(loss.after < 1000);
});

test('practice plans record progress and complete only after every task', () => {
  let active = createPracticePlan('foundations');
  for (let index = 0; index < 3; index += 1) active = recordPracticeEvent(active, { type:'win', mistakes:index ? 1 : 0, mode:'classic', difficulty:'medium' }).plan;
  active = recordPracticeEvent(active, { type:'lesson', id:'nakedSingle' }).plan;
  const result = recordPracticeEvent(active, { type:'lesson', id:'hiddenSingle' });
  assert.equal(result.completedNow, true);
  assert.equal(result.plan.completed, true);
});

test('challenge codes preserve the puzzle and restrictions', () => {
  const generated = generatePuzzle('medium', createSeededRandom('challenge-code'));
  const code = encodeChallenge({
    ...generated, difficulty:'medium', mode:'classic', variant:'classic',
    maxMistakes:2, maxHints:1, notesAllowed:false, timeLimit:600,
    benchmark:{ seconds:420, mistakes:0, hints:0, rating:1200 },
  });
  const decoded = decodeChallenge(code);
  assert.deepEqual(decoded.puzzle, generated.puzzle);
  assert.deepEqual(decoded.solution, generated.solution);
  assert.equal(decoded.maxMistakes, 2);
  assert.equal(decoded.notesAllowed, false);
  assert.equal(decoded.benchmark.seconds, 420);
});

test('compact progress transfer preserves selected progress', () => {
  const lessonIds = ACADEMY_LESSONS.map(({ id }) => id);
  const code = encodeProgressSnapshot({
    prefs:{ theme:'dark', palette:'ocean', boardStyle:'soft', language:'lt', sound:true, haptics:false, autoPause:true },
    stats:{ played:40, won:30, streak:5, maxDailyStreak:12, points:9000, rating:1280, ratingPeak:1310, streakShields:2, achievements:ACHIEVEMENT_IDS.slice(0, 3), academyCompleted:lessonIds.slice(0, 4), dailyCompleted:['2026-07-14','2026-07-15'] },
    achievementIds:ACHIEVEMENT_IDS,
    lessonIds,
  });
  const decoded = decodeProgressSnapshot(code, ACHIEVEMENT_IDS, lessonIds);
  assert.equal(decoded.prefs.language, 'lt');
  assert.equal(decoded.stats.rating, 1280);
  assert.deepEqual(decoded.stats.academyCompleted, lessonIds.slice(0, 4));
  assert.deepEqual(decoded.stats.dailyCompleted, ['2026-07-14','2026-07-15']);
});

test('offline QR encoder creates a square matrix with finder patterns', () => {
  const matrix = createQrMatrix('SDP1.offline-transfer');
  assert.ok(matrix.length >= 21);
  assert.ok(matrix.every((row) => row.length === matrix.length));
  assert.equal(matrix[0][0], true);
  assert.equal(matrix[6][6], true);
  assert.equal(matrix[3][3], true);
});
