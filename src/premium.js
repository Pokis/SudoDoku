import { buildCandidateMap, findTechniqueHint } from './techniques.js';
import { solve } from './sudoku.js';

export const TECHNIQUE_TIERS = {
  nakedSingle:1, hiddenSingle:1,
  pointingPair:2, boxLineReduction:2, nakedPair:2, hiddenPair:2,
  nakedTriple:3, hiddenTriple:3, xWing:3,
  xyWing:4, skyscraper:4, swordfish:4,
  reveal:5,
};

export const PRACTICE_PLANS = [
  {
    id:'foundations',
    titleKey:'plans.foundations',
    descriptionKey:'plans.foundationsText',
    reward:500,
    tasks:[
      { id:'wins', type:'wins', target:3, labelKey:'plans.taskWins' },
      { id:'lessons', type:'lessons', target:2, labelKey:'plans.taskLessons' },
      { id:'clean', type:'cleanWins', target:1, labelKey:'plans.taskClean' },
    ],
  },
  {
    id:'pairs',
    titleKey:'plans.pairs',
    descriptionKey:'plans.pairsText',
    reward:750,
    tasks:[
      { id:'pairLessons', type:'specificLessons', values:['nakedPair','hiddenPair'], target:2, labelKey:'plans.taskPairLessons' },
      { id:'pairTechniques', type:'specificTechniques', values:['nakedPair','hiddenPair'], target:2, labelKey:'plans.taskPairTechniques' },
      { id:'hardWins', type:'hardWins', target:2, labelKey:'plans.taskHardWins' },
    ],
  },
  {
    id:'fish',
    titleKey:'plans.fish',
    descriptionKey:'plans.fishText',
    reward:1200,
    tasks:[
      { id:'fishLessons', type:'specificLessons', values:['xWing','swordfish'], target:2, labelKey:'plans.taskFishLessons' },
      { id:'fishTechniques', type:'specificTechniques', values:['xWing','swordfish'], target:2, labelKey:'plans.taskFishTechniques' },
      { id:'expertWins', type:'expertWins', target:3, labelKey:'plans.taskExpertWins' },
    ],
  },
  {
    id:'noNotes',
    titleKey:'plans.noNotes',
    descriptionKey:'plans.noNotesText',
    reward:1000,
    tasks:[
      { id:'noNotesWins', type:'noNotesWins', target:3, labelKey:'plans.taskNoNotesWins' },
      { id:'cleanWins', type:'cleanWins', target:2, labelKey:'plans.taskCleanWins' },
    ],
  },
  {
    id:'daily',
    titleKey:'plans.daily',
    descriptionKey:'plans.dailyText',
    reward:900,
    tasks:[
      { id:'dailyWins', type:'dailyWins', target:5, labelKey:'plans.taskDailyWins' },
      { id:'dailyClean', type:'dailyCleanWins', target:2, labelKey:'plans.taskDailyClean' },
    ],
  },
];

const difficultyTarget = { easy:800, medium:1000, hard:1225, expert:1450 };
const gradeTarget = { foundation:850, intermediate:1050, advanced:1275, expert:1500, grandmaster:1650 };

const bytesToBase64Url = (bytes) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlToBytes = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const encodeObject = (value) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
const decodeObject = (value) => JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));

function intersectCandidates(board, previous, variant) {
  const legal = buildCandidateMap(board, variant);
  return legal.map((candidates, index) => {
    if (board[index]) return [];
    if (!previous?.[index]?.length) return candidates;
    return candidates.filter((value) => previous[index].includes(value));
  });
}

export function gradePuzzleByTechniques(puzzle, solution, variant = 'classic') {
  const board = [...puzzle];
  let candidates = buildCandidateMap(board, variant);
  const techniques = {};
  let unsupported = 0;
  let steps = 0;
  let guard = 0;

  while (board.some((value) => !value) && guard < 700) {
    guard += 1;
    candidates = intersectCandidates(board, candidates, variant);
    const hint = findTechniqueHint(board, solution, variant, null, candidates);
    if (!hint || hint.technique === 'reveal') {
      const index = board.findIndex((value) => !value);
      if (index < 0) break;
      unsupported += 1;
      board[index] = solution[index];
      candidates[index] = [];
      continue;
    }

    techniques[hint.technique] = (techniques[hint.technique] || 0) + 1;
    steps += 1;
    if (Number.isInteger(hint.index) && Number.isInteger(hint.value)) {
      board[hint.index] = hint.value;
      candidates[hint.index] = [];
      continue;
    }

    let changed = false;
    for (const elimination of hint.eliminations || []) {
      const before = candidates[elimination.index]?.length || 0;
      candidates[elimination.index] = (candidates[elimination.index] || []).filter((value) => value !== elimination.value);
      changed ||= candidates[elimination.index].length < before;
    }
    if (!changed) {
      const index = board.findIndex((value) => !value);
      if (index < 0) break;
      unsupported += 1;
      board[index] = solution[index];
      candidates[index] = [];
    }
  }

  const hardestTechnique = Object.keys(techniques).sort((first, second) => (TECHNIQUE_TIERS[second] || 0) - (TECHNIQUE_TIERS[first] || 0))[0] || 'nakedSingle';
  const hardestTier = unsupported ? 5 : (TECHNIQUE_TIERS[hardestTechnique] || 1);
  const labels = ['foundation','foundation','intermediate','advanced','expert','grandmaster'];
  return {
    label:labels[hardestTier],
    score:Math.min(100, 20 + hardestTier * 15 + Object.keys(techniques).length * 3 + Math.min(10, unsupported * 2)),
    techniques,
    hardestTechnique,
    steps,
    unsupported,
    solvedByLogic:unsupported === 0,
  };
}

export function calculateRatingUpdate(currentRating, result) {
  const current = Math.max(400, Number(currentRating) || 1000);
  const puzzleRating = Math.round(((difficultyTarget[result.difficulty] || 1000) + (gradeTarget[result.grade?.label] || 1000)) / 2);
  const expected = 1 / (1 + 10 ** ((puzzleRating - current) / 400));
  const targetTime = { easy:420, medium:720, hard:1080, expert:1500 }[result.difficulty] || 900;
  const pace = Math.max(-0.15, Math.min(0.15, (targetTime - Number(result.seconds || 0)) / targetTime * 0.15));
  const accuracy = Math.max(-0.18, 0.08 - Number(result.mistakes || 0) * 0.06 - Number(result.hints || 0) * 0.035);
  const actual = result.won ? Math.max(0.55, Math.min(1, 0.82 + pace + accuracy)) : 0;
  const change = Math.round(40 * (actual - expected));
  const rating = Math.max(400, Math.min(2400, current + change));
  return { before:current, after:rating, change, puzzleRating };
}

export function recommendDifficulty(rating, history = []) {
  const recent = history.filter((entry) => entry.won).slice(-5);
  const accuracy = recent.length ? recent.reduce((total, entry) => total + (entry.mistakes === 0 ? 1 : 0), 0) / recent.length : 0.5;
  const adjusted = Number(rating || 1000) + (accuracy - 0.5) * 160;
  if (adjusted < 900) return 'easy';
  if (adjusted < 1125) return 'medium';
  if (adjusted < 1400) return 'hard';
  return 'expert';
}

export function createPracticePlan(id) {
  if (!PRACTICE_PLANS.some((plan) => plan.id === id)) return null;
  return { id, startedAt:new Date().toISOString(), progress:{}, completed:false };
}

export function recordPracticeEvent(activePlan, event) {
  if (!activePlan || activePlan.completed) return { plan:activePlan, completedNow:false };
  const definition = PRACTICE_PLANS.find((plan) => plan.id === activePlan.id);
  if (!definition) return { plan:null, completedNow:false };
  const progress = { ...(activePlan.progress || {}) };
  const increment = (type, value = 1) => { progress[type] = Number(progress[type] || 0) + value; };
  const addUnique = (type, value) => { progress[type] = [...new Set([...(Array.isArray(progress[type]) ? progress[type] : []), value])]; };

  if (event.type === 'win') {
    increment('wins');
    if (event.mistakes === 0) increment('cleanWins');
    if (event.mode === 'daily') increment('dailyWins');
    if (event.mode === 'daily' && event.mistakes === 0) increment('dailyCleanWins');
    if (!event.manualNotesUsed && !event.autoNotesUsed && !event.hintsUsed) increment('noNotesWins');
    if (event.difficulty === 'hard' || event.difficulty === 'expert') increment('hardWins');
    if (event.difficulty === 'expert') increment('expertWins');
  }
  if (event.type === 'lesson') addUnique('lessons', event.id);
  if (event.type === 'technique') addUnique('techniques', event.id);

  const valueForTask = (task) => {
    if (task.type === 'specificLessons') return task.values.filter((id) => (progress.lessons || []).includes(id)).length;
    if (task.type === 'specificTechniques') return task.values.filter((id) => (progress.techniques || []).includes(id)).length;
    if (task.type === 'lessons') return (progress.lessons || []).length;
    return Number(progress[task.type] || 0);
  };
  const completed = definition.tasks.every((task) => valueForTask(task) >= task.target);
  return { plan:{ ...activePlan, progress, completed, completedAt:completed ? new Date().toISOString() : null }, completedNow:completed && !activePlan.completed };
}

export function practiceTaskProgress(activePlan, task) {
  const progress = activePlan?.progress || {};
  if (task.type === 'specificLessons') return task.values.filter((id) => (progress.lessons || []).includes(id)).length;
  if (task.type === 'specificTechniques') return task.values.filter((id) => (progress.techniques || []).includes(id)).length;
  if (task.type === 'lessons') return (progress.lessons || []).length;
  return Number(progress[task.type] || 0);
}

export function encodeChallenge(challenge) {
  const payload = {
    v:1,
    p:challenge.puzzle.join(''),
    d:challenge.difficulty,
    m:challenge.mode,
    r:challenge.variant,
    x:[challenge.maxMistakes, challenge.maxHints, challenge.notesAllowed ? 1 : 0, challenge.timeLimit || 0],
    b:challenge.benchmark ? [challenge.benchmark.seconds, challenge.benchmark.mistakes, challenge.benchmark.hints, challenge.benchmark.rating] : null,
  };
  return `SDC1.${encodeObject(payload)}`;
}

export function decodeChallenge(code) {
  const source = String(code || '').trim();
  const token = source.includes('challenge=') ? new URL(source, location.href).searchParams.get('challenge') : source;
  if (!token?.startsWith('SDC1.')) throw new Error('Invalid challenge code');
  const payload = decodeObject(token.slice(5));
  const size = payload.p.length === 36 ? 6 : 9;
  const puzzle = [...payload.p].map(Number);
  const variant = payload.r || (size === 6 ? 'mini' : 'classic');
  const solution = payload.s ? [...payload.s].map(Number) : [...puzzle];
  if (!payload.s && !solve(solution, false, Math.random, variant)) throw new Error('Invalid challenge payload');
  if (payload.v !== 1 || puzzle.length !== solution?.length || ![36,81].includes(puzzle.length) || puzzle.some((value) => value < 0 || value > size) || solution.some((value) => value < 1 || value > size)) throw new Error('Invalid challenge payload');
  return {
    puzzle, solution,
    difficulty:payload.d || 'medium',
    mode:payload.m || 'classic',
    variant,
    maxMistakes:Math.max(1, Math.min(9, Number(payload.x?.[0] || 3))),
    maxHints:Math.max(0, Math.min(9, Number(payload.x?.[1] ?? 3))),
    notesAllowed:Boolean(payload.x?.[2]),
    timeLimit:Math.max(0, Math.min(7200, Number(payload.x?.[3] || 0))),
    benchmark:Array.isArray(payload.b) ? { seconds:Number(payload.b[0] || 0), mistakes:Number(payload.b[1] || 0), hints:Number(payload.b[2] || 0), rating:Number(payload.b[3] || 0) } : null,
  };
}

const bitsetFor = (allIds, selectedIds) => {
  let bits = 0n;
  allIds.forEach((id, index) => { if (selectedIds.includes(id)) bits |= 1n << BigInt(index); });
  return bits.toString(36);
};

const idsFromBitset = (allIds, bitset) => {
  let bits = 0n;
  for (const character of String(bitset || '0')) bits = bits * 36n + BigInt(parseInt(character, 36));
  return allIds.filter((id, index) => Boolean(bits & (1n << BigInt(index))));
};

export function encodeProgressSnapshot({ prefs, stats, achievementIds, lessonIds }) {
  const dayNumbers = [...new Set((stats.dailyCompleted || []).slice(-40).map((key) => Math.floor(new Date(`${key}T12:00:00Z`).getTime() / 86400000)))].sort((first, second) => first - second);
  const days = dayNumbers.length ? [dayNumbers[0].toString(36), dayNumbers.slice(1).map((day, index) => (day - dayNumbers[index]).toString(36)).join('.')] : [];
  const payload = {
    v:1,
    p:[prefs.theme === 'dark' ? 1 : 0, ['lavender','ocean','forest','sunset'].indexOf(prefs.palette), ['classic','soft','paper','neon'].indexOf(prefs.boardStyle), ['en','lt','es','de','uk'].indexOf(prefs.language), prefs.sound ? 1 : 0, prefs.haptics ? 1 : 0, prefs.autoPause ? 1 : 0],
    s:[stats.played, stats.won, stats.streak, stats.maxDailyStreak, stats.points, stats.rating, stats.ratingPeak, stats.streakShields],
    a:bitsetFor(achievementIds, stats.achievements || []),
    l:bitsetFor(lessonIds, stats.academyCompleted || []),
    d:days,
  };
  return `SDP1.${encodeObject(payload)}`;
}

export function decodeProgressSnapshot(code, achievementIds, lessonIds) {
  const source = String(code || '').trim();
  const token = source.includes('transfer=') ? new URL(source, location.href).searchParams.get('transfer') : source;
  if (!token?.startsWith('SDP1.')) throw new Error('Invalid transfer code');
  const payload = decodeObject(token.slice(5));
  if (payload.v !== 1 || !Array.isArray(payload.p) || !Array.isArray(payload.s)) throw new Error('Invalid transfer payload');
  const dayNumbers = [];
  if (Array.isArray(payload.d) && payload.d[0]) {
    let current = parseInt(payload.d[0], 36);
    dayNumbers.push(current);
    String(payload.d[1] || '').split('.').filter(Boolean).forEach((delta) => { current += parseInt(delta, 36); dayNumbers.push(current); });
  }
  return {
    prefs:{
      theme:payload.p[0] ? 'dark' : 'light',
      palette:['lavender','ocean','forest','sunset'][payload.p[1]] || 'lavender',
      boardStyle:['classic','soft','paper','neon'][payload.p[2]] || 'classic',
      language:['en','lt','es','de','uk'][payload.p[3]] || 'en',
      sound:Boolean(payload.p[4]), haptics:Boolean(payload.p[5]), autoPause:Boolean(payload.p[6]),
    },
    stats:{
      played:Number(payload.s[0] || 0), won:Number(payload.s[1] || 0), streak:Number(payload.s[2] || 0), maxDailyStreak:Number(payload.s[3] || 0),
      points:Number(payload.s[4] || 0), rating:Number(payload.s[5] || 1000), ratingPeak:Number(payload.s[6] || payload.s[5] || 1000), streakShields:Number(payload.s[7] || 0),
      achievements:idsFromBitset(achievementIds, payload.a), academyCompleted:idsFromBitset(lessonIds, payload.l),
      dailyCompleted:dayNumbers.map((value) => new Date(value * 86400000).toISOString().slice(0, 10)),
    },
  };
}
