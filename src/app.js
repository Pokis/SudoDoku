import { createSeededRandom, generatePuzzle, getCandidates, getHyperRegion, getPeers, getVariantConfig, isComplete, shuffled } from './sudoku.js';
import { applyDocumentTranslations, LOCALES, translate } from './i18n.js';
import { buildCandidateMap, findTechniqueHint } from './techniques.js';
import { ACADEMY_LESSONS, getAcademyLesson, isAcademyAnswer } from './academy.js';
import { createBackupPayload, validateBackupPayload } from './backup.js';

const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = 'sudodoku-game-v1';
const PREFS_KEY = 'sudodoku-prefs-v1';
const STATS_KEY = 'sudodoku-stats-v1';

const elements = {
  board: $('#board'), numpad: $('#numpad'), timer: $('#timer'), mistakes: $('#mistakeCount'),
  difficultyLabel: $('#difficultyLabel'), difficultyButton: $('#difficultyButton'), difficultyMenu: $('#difficultyMenu'), modeButton: $('#modeButton'), modeMenu: $('#modeMenu'),
  pauseButton: $('#pauseButton'), resumeButton: $('#resumeButton'), notesButton: $('#notesButton'), notesBadge: $('#notesBadge'),
  undoButton: $('#undoButton'), eraseButton: $('#eraseButton'), autoNotesButton: $('#autoNotesButton'), autoNotesBadge: $('#autoNotesBadge'), hintButton: $('#hintButton'), hintCount: $('#hintCount'),
  hintCoach: $('#hintCoach'), hintCoachTitle: $('#hintCoachTitle'), hintCoachText: $('#hintCoachText'), hintCoachClose: $('#hintCoachClose'),
  newGameButton: $('#newGameButton'), progressRing: $('#progressRing'), progressPercent: $('#progressPercent'), progressText: $('#progressText'),
  themeButton: $('#themeButton'), soundButton: $('#soundButton'), statsButton: $('#statsButton'), modeChip: $('#modeChip'),
  settingsButton: $('#settingsButton'), languageCode: $('#languageCode'), homeButton: $('#homeButton'), gameMenuButton: $('#gameMenuButton'),
  levelBadge: $('#levelBadge'), questTitle: $('#questTitle'), questDescription: $('#questDescription'), questReward: $('#questReward'), questProgress: $('#questProgress'), questCount: $('#questCount'),
  dailyButton: $('#dailyButton'), dailyTitle: $('#dailyTitle'), dailySubtitle: $('#dailySubtitle'),
  dialog: $('#gameDialog'), dialogEyebrow: $('#dialogEyebrow'), dialogTitle: $('#dialogTitle'), dialogText: $('#dialogText'),
  resultGrid: $('#resultGrid'), resultTime: $('#resultTime'), resultMistakes: $('#resultMistakes'), resultScore: $('#resultScore'),
  unlockBanner: $('#unlockBanner'), unlockText: $('#unlockText'), dialogAction: $('#dialogAction'), dialogClose: $('#dialogClose'), shareResultButton: $('#shareResultButton'),
  statsDialog: $('#statsDialog'), statsClose: $('#statsClose'), statsPlay: $('#statsPlay'),
  statPlayed: $('#statPlayed'), statWon: $('#statWon'), statStreak: $('#statStreak'), statBest: $('#statBest'),
  statPoints: $('#statPoints'), statDaily: $('#statDaily'), achievementList: $('#achievementList'), achievementCount: $('#achievementCount'), achievementHistoryList: $('#achievementHistoryList'), achievementHistoryCount: $('#achievementHistoryCount'), toast: $('#toast'),
  settingsDialog: $('#settingsDialog'), settingsClose: $('#settingsClose'), settingsDone: $('#settingsDone'),
  settingsLanguage: $('#settingsLanguage'), hapticsToggle: $('#hapticsToggle'), autoPauseToggle: $('#autoPauseToggle'), replayIntroButton: $('#replayIntroButton'),
  themeGrid: $('#themeGrid'), boardStyleGrid: $('#boardStyleGrid'),
  pwaSummary: $('#pwaSummary'), pwaConnection: $('#pwaConnection'), pwaCache: $('#pwaCache'), pwaVersion: $('#pwaVersion'), pwaInstallState: $('#pwaInstallState'),
  pwaInstallButton: $('#pwaInstallButton'), pwaInstallButtons: [...document.querySelectorAll('[data-install-app]')], pwaCheckButton: $('#pwaCheckButton'), pwaRepairButton: $('#pwaRepairButton'), updateBanner: $('#updateBanner'), updateAction: $('#updateAction'), updateDismiss: $('#updateDismiss'), progressEventStack: $('#progressEventStack'),
  introScreen: $('#introScreen'), languageLaunch: $('#languageLaunch'), introCard: $('#introCard'), languageChoiceGrid: $('#languageChoiceGrid'), languageLaunchCurrent: $('#languageLaunchCurrent'), languageContinue: $('#languageContinue'), introLanguage: $('#introLanguage'), introStart: $('#introStart'), miniBoard: $('#miniBoard'),
  replayButton: $('#replayButton'), replayDialog: $('#replayDialog'), replayClose: $('#replayClose'), replayBoard: $('#replayBoard'), replayRange: $('#replayRange'), replayPlay: $('#replayPlay'), replayStep: $('#replayStep'), replayCaption: $('#replayCaption'),
  academyButton: $('#academyButton'), academySettingsButton: $('#academySettingsButton'), academyDialog: $('#academyDialog'), academyClose: $('#academyClose'), academyCardProgress: $('#academyCardProgress'), academySettingsProgress: $('#academySettingsProgress'), academyCompleteCount: $('#academyCompleteCount'), academyProgressBar: $('#academyProgressBar'), academyLessonList: $('#academyLessonList'), academyStage: $('#academyStage'), academyRules: $('#academyRules'), academyRulesStart: $('#academyRulesStart'), academyLessonLevel: $('#academyLessonLevel'), academyLessonReward: $('#academyLessonReward'), academyLessonTitle: $('#academyLessonTitle'), academyLessonIntro: $('#academyLessonIntro'), academyBoard: $('#academyBoard'), academySteps: $('#academySteps'), academyQuestion: $('#academyQuestion'), academyChoices: $('#academyChoices'), academyFeedback: $('#academyFeedback'), academyNextButton: $('#academyNextButton'),
  backupSummary: $('#backupSummary'), backupStatus: $('#backupStatus'), backupExportButton: $('#backupExportButton'), backupRestoreButton: $('#backupRestoreButton'), backupFileInput: $('#backupFileInput'),
  mainMenu: $('#mainMenu'), menuContinueButton: $('#menuContinueButton'), menuContinueTitle: $('#menuContinueTitle'), menuContinueProgress: $('#menuContinueProgress'), menuLevel: $('#menuLevel'), menuPoints: $('#menuPoints'), menuAchievements: $('#menuAchievements'), menuLessons: $('#menuLessons'), menuAcademyButton: $('#menuAcademyButton'), menuStatsButton: $('#menuStatsButton'), menuSettingsButton: $('#menuSettingsButton'),
};

const modeWins = (summary, mode) => Number(summary.modeWins?.[mode] || 0);
const bestTimedSolve = (summary) => Math.min(...Object.entries(summary.bestByMode || {}).filter(([mode, value]) => mode !== 'zen' && Number.isFinite(value)).map(([, value]) => value), Infinity);
const levelFromPoints = (points) => Math.max(1, Math.floor(Number(points || 0) / 4000) + 1);
const masteredLessons = (summary) => Array.isArray(summary.academyCompleted) ? summary.academyCompleted.length : 0;
const discoveredTechniques = (summary) => Array.isArray(summary.techniquesDiscovered) ? summary.techniquesDiscovered.length : 0;
const ACHIEVEMENTS = [
  { id:'first-flow', tier:'common', target:1, progress:(summary) => summary.won },
  { id:'clean-grid', tier:'common', target:1, progress:(summary) => summary.perfectWins },
  { id:'pure-logic', tier:'common', target:1, progress:(summary) => summary.pureLogicWins },
  { id:'daily-devotion', tier:'common', target:1, progress:(summary) => summary.dailyCompleted.length },
  { id:'streak-three', tier:'common', target:3, progress:(summary) => summary.maxDailyStreak },
  { id:'academy-initiate', tier:'common', target:4, progress:masteredLessons },
  { id:'speed-focus', tier:'rare', target:1, progress:(summary) => bestTimedSolve(summary) < 300 ? 1 : 0 },
  { id:'explorer', tier:'rare', target:3, progress:(summary) => ['killer','hyper','mini'].filter((mode) => modeWins(summary, mode) > 0).length },
  { id:'mini-sprint', tier:'rare', target:1, progress:(summary) => Number(summary.bestByMode?.mini) > 0 && summary.bestByMode.mini < 90 ? 1 : 0 },
  { id:'expert-mind', tier:'rare', target:1, progress:(summary) => summary.expertWins },
  { id:'perfect-ten', tier:'rare', target:10, progress:(summary) => summary.bestPerfectStreak },
  { id:'academy-scholar', tier:'rare', target:8, progress:masteredLessons },
  { id:'fish-school', tier:'rare', target:2, progress:(summary) => ['xWing','swordfish'].filter((id) => summary.academyCompleted?.includes(id)).length },
  { id:'killer-adept', tier:'epic', target:25, progress:(summary) => modeWins(summary, 'killer') },
  { id:'hyper-architect', tier:'epic', target:25, progress:(summary) => modeWins(summary, 'hyper') },
  { id:'zen-master', tier:'epic', target:50, progress:(summary) => modeWins(summary, 'zen') },
  { id:'variant-voyager', tier:'epic', target:100, progress:(summary) => modeWins(summary, 'killer') + modeWins(summary, 'hyper') + modeWins(summary, 'mini') },
  { id:'logic-fifty', tier:'epic', target:50, progress:(summary) => summary.pureLogicWins },
  { id:'expert-pure', tier:'epic', target:50, progress:(summary) => summary.expertPureWins },
  { id:'weekly-ten', tier:'epic', target:10, progress:(summary) => summary.weeklyQuests },
  { id:'daily-thirty', tier:'epic', target:30, progress:(summary) => summary.maxDailyStreak },
  { id:'century', tier:'epic', target:100, progress:(summary) => summary.won },
  { id:'academy-master', tier:'epic', target:ACADEMY_LESSONS.length, progress:masteredLessons },
  { id:'pattern-voyager', tier:'epic', target:6, progress:discoveredTechniques },
  { id:'logical-guide', tier:'epic', target:100, progress:(summary) => summary.logicalHints },
  { id:'perfect-century', tier:'legendary', target:100, progress:(summary) => summary.perfectWins },
  { id:'logic-legend', tier:'legendary', target:250, progress:(summary) => summary.pureLogicWins },
  { id:'weekly-fifty', tier:'legendary', target:50, progress:(summary) => summary.weeklyQuests },
  { id:'level-twenty-five', tier:'legendary', target:25, progress:(summary) => levelFromPoints(summary.points) },
  { id:'deep-focus', tier:'legendary', target:360000, progress:(summary) => summary.totalSeconds, format:'hours' },
  { id:'daily-century', tier:'legendary', target:100, progress:(summary) => summary.maxDailyStreak },
  { id:'technique-librarian', tier:'legendary', target:ACADEMY_LESSONS.length, progress:discoveredTechniques },
  { id:'year-of-focus', tier:'mythic', target:365, progress:(summary) => summary.maxDailyStreak },
  { id:'grandmaster', tier:'mythic', target:1000, progress:(summary) => summary.won },
  { id:'level-fifty', tier:'mythic', target:50, progress:(summary) => levelFromPoints(summary.points) },
  { id:'deduction-sage', tier:'mythic', target:1000, progress:(summary) => summary.logicalHints },
  { id:'night-owl', tier:'rare', target:1, progress:(summary) => summary.nightWins, secret:true },
  { id:'close-call', tier:'epic', target:1, progress:(summary) => summary.closeCallWins, secret:true },
  { id:'no-pencil', tier:'legendary', target:1, progress:(summary) => summary.noPencilWins, secret:true },
  { id:'patient-mind', tier:'epic', target:1, progress:(summary) => summary.patientWins, secret:true },
];
const THEME_PACKS = [{ id:'lavender', level:1, color:'#6d5dfc' },{ id:'ocean', level:2, color:'#1687c9' },{ id:'forest', level:3, color:'#278c62' },{ id:'sunset', level:4, color:'#e26172' }];
const BOARD_STYLES = [{ id:'classic', level:1 },{ id:'soft', level:2 },{ id:'paper', level:3 },{ id:'neon', level:4 }];
const defaultStats = {
  played:0, won:0, streak:0, maxDailyStreak:0, lastWin:null, best:{}, bestByMode:{}, points:0,
  dailyCompleted:[], achievements:[], weekly:null, weeklyQuests:0, totalSeconds:0, totalMistakes:0,
  totalHints:0, perfectWins:0, pureLogicWins:0, expertWins:0, expertPureWins:0,
  currentPerfectStreak:0, bestPerfectStreak:0, modeWins:{ classic:0, daily:0, killer:0, hyper:0, mini:0, zen:0 },
  nightWins:0, closeCallWins:0, noPencilWins:0, patientWins:0, achievementHistory:[], nearNotified:[],
  academyCompleted:[], techniquesDiscovered:[], logicalHints:0,
};
const browserLanguage = navigator.language?.split('-')[0];
const defaultPrefs = { theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', palette: 'lavender', boardStyle: 'classic', sound: true, language: LOCALES.some(({ code }) => code === browserLanguage) ? browserLanguage : 'en', haptics: true, autoPause: true, onboarded: false, languageConfirmed: false, academyRulesSeen: false };
let prefs = { ...defaultPrefs, ...readJSON(PREFS_KEY, {}) };
let stats = { ...defaultStats, ...readJSON(STATS_KEY, {}) };
stats.dailyCompleted = Array.isArray(stats.dailyCompleted) ? stats.dailyCompleted : [];
stats.achievements = Array.isArray(stats.achievements) ? stats.achievements : [];
stats.achievementHistory = Array.isArray(stats.achievementHistory) ? stats.achievementHistory : [];
stats.nearNotified = Array.isArray(stats.nearNotified) ? stats.nearNotified : [];
stats.academyCompleted = Array.isArray(stats.academyCompleted) ? stats.academyCompleted.filter((id) => ACADEMY_LESSONS.some((lesson) => lesson.id === id)) : [];
stats.techniquesDiscovered = Array.isArray(stats.techniquesDiscovered) ? [...new Set(stats.techniquesDiscovered.filter((id) => ACADEMY_LESSONS.some((lesson) => lesson.id === id)))] : [];
stats.best = stats.best && typeof stats.best === 'object' ? stats.best : {};
stats.bestByMode = { ...defaultStats.bestByMode, ...(stats.bestByMode && typeof stats.bestByMode === 'object' ? stats.bestByMode : {}) };
stats.modeWins = { ...defaultStats.modeWins, ...(stats.modeWins && typeof stats.modeWins === 'object' ? stats.modeWins : {}) };
let state;
let timerId;
let toastId;
let audioContext;
let cells = [];
let replayTimer;
let replayFrames = [];
let swRegistration;
let deferredInstallPrompt;
let updateRequested = false;
let academyCurrentLesson = prefs.academyRulesSeen ? ACADEMY_LESSONS[0].id : 'rules';
let pendingAcademyEvents = [];

const t = (key, variables) => translate(prefs.language, key, variables);

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function dateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function freshState(difficulty = 'medium', options = {}) {
  const random = options.seed ? createSeededRandom(options.seed) : Math.random;
  const mode = options.mode || 'classic';
  const variant = options.variant || (mode === 'hyper' ? 'hyper' : mode === 'mini' ? 'mini' : 'classic');
  const generated = generatePuzzle(difficulty, random, variant);
  const { size, boxRows, boxCols } = getVariantConfig(variant);
  return {
    ...generated,
    values: [...generated.puzzle],
    notes: Array.from({ length: generated.puzzle.length }, () => []),
    selected: generated.puzzle.findIndex((value) => !value),
    mistakes: 0,
    hints: 3,
    hintsUsed: 0,
    autoNotesUsed: false,
    smartNotesActive: false,
    manualNotesUsed: false,
    lastHint: null,
    mode,
    variant,
    size,
    boxRows,
    boxCols,
    cages: mode === 'killer' ? createKillerCages(generated.solution, random) : [],
    dailyDate: options.dailyDate || null,
    seconds: 0,
    notesMode: false,
    paused: false,
    status: 'playing',
    history: [],
    replay: [],
    startedAt: Date.now(),
  };
}

function dailyConfig() {
  const today = dateKey();
  const rotation = ['medium', 'hard', 'medium', 'expert', 'hard', 'easy', 'hard'];
  const dayNumber = Math.floor(new Date(`${today}T12:00:00`).getTime() / 86400000);
  return { date: today, difficulty: rotation[dayNumber % rotation.length], seed: `sudodoku-daily-${today}` };
}

function createKillerCages(solution, random = Math.random) {
  const size = 9;
  const available = new Set(solution.map((_, index) => index));
  const cages = [];
  for (const start of shuffled([...available], random)) {
    if (!available.has(start)) continue;
    const cells = [start]; available.delete(start);
    const targetSize = 2 + Math.floor(random() * 3);
    while (cells.length < targetSize) {
      const frontier = shuffled(cells.flatMap((index) => {
        const row = Math.floor(index / size); const col = index % size;
        return [row > 0 && index - size, row < size - 1 && index + size, col > 0 && index - 1, col < size - 1 && index + 1].filter(Number.isInteger);
      }), random);
      const next = frontier.find((index) => available.has(index) && !cells.some((cell) => solution[cell] === solution[index]));
      if (next == null) break;
      cells.push(next); available.delete(next);
    }
    cages.push({ id: cages.length, cells, sum: cells.reduce((total, index) => total + solution[index], 0) });
  }
  return cages;
}

function renderCustomizationOptions() {
  if (!elements.themeGrid) return;
  const level = playerLevel();
  elements.themeGrid.replaceChildren(...THEME_PACKS.map((theme) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `theme-option${prefs.palette === theme.id ? ' selected' : ''}${level < theme.level ? ' locked' : ''}`;
    button.style.setProperty('--swatch', theme.color); button.textContent = t(`theme.${theme.id}`);
    button.addEventListener('click', () => {
      if (level < theme.level) return showToast(t('toast.unlockLevel', { level: theme.level }));
      prefs.palette = theme.id; savePrefs(); applyPrefs(); renderCustomizationOptions();
    });
    return button;
  }));
  elements.boardStyleGrid.replaceChildren(...BOARD_STYLES.map((style) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `style-option${prefs.boardStyle === style.id ? ' selected' : ''}${level < style.level ? ' locked' : ''}`;
    const label = document.createElement('span'); label.textContent = t(`style.${style.id}`); button.append(label);
    button.addEventListener('click', () => {
      if (level < style.level) return showToast(t('toast.unlockLevel', { level: style.level }));
      prefs.boardStyle = style.id; savePrefs(); applyPrefs(); renderCustomizationOptions();
    });
    return button;
  }));
}

function validSavedGame(saved) {
  const size = saved?.puzzle?.length === 36 ? 6 : 9;
  const validBoard = (board, allowZero) => Array.isArray(board) && board.length === saved?.puzzle?.length && board.every((value) => Number.isInteger(value) && value >= (allowZero ? 0 : 1) && value <= size);
  return saved && validBoard(saved.puzzle, true) &&
    Array.isArray(saved.solution) && saved.solution.length === saved.puzzle.length &&
    validBoard(saved.solution, false) && validBoard(saved.values, true) &&
    Array.isArray(saved.notes) && saved.notes.length === saved.puzzle.length && saved.notes.every((note) => Array.isArray(note) && note.every((value) => Number.isInteger(value) && value >= 1 && value <= size)) &&
    Number.isFinite(saved.seconds) && saved.seconds >= 0 && Number.isFinite(saved.mistakes) && saved.mistakes >= 0 &&
    Number.isFinite(saved.hints) && saved.hints >= 0 && Number.isInteger(saved.selected) && saved.selected >= -1 && saved.selected < saved.puzzle.length &&
    ['easy','medium','hard','expert'].includes(saved.difficulty) && saved.status === 'playing';
}

function save() {
  if (!state || state.status !== 'playing') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function savePrefs() { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }
function saveStats() { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }

function sanitizeBackupPrefs(raw) {
  const safe = { ...defaultPrefs };
  if (['light','dark'].includes(raw.theme)) safe.theme = raw.theme;
  if (THEME_PACKS.some(({ id }) => id === raw.palette)) safe.palette = raw.palette;
  if (BOARD_STYLES.some(({ id }) => id === raw.boardStyle)) safe.boardStyle = raw.boardStyle;
  if (LOCALES.some(({ code }) => code === raw.language)) safe.language = raw.language;
  ['sound','haptics','autoPause','onboarded','languageConfirmed','academyRulesSeen'].forEach((key) => { if (typeof raw[key] === 'boolean') safe[key] = raw[key]; });
  if (Number.isFinite(Date.parse(raw.lastBackupAt))) safe.lastBackupAt = raw.lastBackupAt;
  safe.lastRestoreAt = new Date().toISOString();
  return safe;
}

function sanitizeBackupStats(raw) {
  const safe = { ...defaultStats };
  Object.entries(defaultStats).forEach(([key, fallback]) => {
    if (typeof fallback === 'number' && Number.isFinite(raw[key]) && raw[key] >= 0) safe[key] = raw[key];
  });
  safe.lastWin = typeof raw.lastWin === 'string' ? raw.lastWin : null;
  safe.dailyCompleted = Array.isArray(raw.dailyCompleted) ? raw.dailyCompleted.filter((item) => typeof item === 'string').slice(-1000) : [];
  safe.achievements = Array.isArray(raw.achievements) ? [...new Set(raw.achievements.filter((id) => ACHIEVEMENTS.some((achievement) => achievement.id === id)))] : [];
  safe.nearNotified = Array.isArray(raw.nearNotified) ? [...new Set(raw.nearNotified.filter((id) => ACHIEVEMENTS.some((achievement) => achievement.id === id)))] : [];
  safe.academyCompleted = Array.isArray(raw.academyCompleted) ? [...new Set(raw.academyCompleted.filter((id) => ACADEMY_LESSONS.some((lesson) => lesson.id === id)))] : [];
  safe.techniquesDiscovered = Array.isArray(raw.techniquesDiscovered) ? [...new Set(raw.techniquesDiscovered.filter((id) => ACADEMY_LESSONS.some((lesson) => lesson.id === id)))] : [];
  safe.achievementHistory = Array.isArray(raw.achievementHistory) ? raw.achievementHistory.filter((entry) => entry && ACHIEVEMENTS.some((achievement) => achievement.id === entry.id) && Number.isFinite(Date.parse(entry.unlockedAt))).slice(0, 100) : [];
  safe.best = Object.fromEntries(Object.entries(raw.best || {}).filter(([, value]) => Number.isFinite(value) && value >= 0));
  safe.bestByMode = Object.fromEntries(Object.entries(raw.bestByMode || {}).filter(([, value]) => Number.isFinite(value) && value >= 0));
  safe.modeWins = { ...defaultStats.modeWins };
  Object.keys(safe.modeWins).forEach((mode) => { if (Number.isFinite(raw.modeWins?.[mode]) && raw.modeWins[mode] >= 0) safe.modeWins[mode] = raw.modeWins[mode]; });
  const weekly = raw.weekly;
  if (weekly && typeof weekly === 'object' && !Array.isArray(weekly) && typeof weekly.key === 'string' && ['complete','logic','variants','daily'].includes(weekly.questId)) {
    safe.weekly = { key:weekly.key, questId:weekly.questId, completedGames:0, noHintWins:0, variantWins:0, dailyWins:0, claimed:weekly.claimed === true };
    ['completedGames','noHintWins','variantWins','dailyWins'].forEach((key) => { if (Number.isFinite(weekly[key]) && weekly[key] >= 0) safe.weekly[key] = weekly[key]; });
  } else safe.weekly = null;
  return safe;
}

function updateBackupUI() {
  elements.backupSummary.textContent = t('backup.summary', { played:stats.played, achievements:stats.achievements.length });
  if (!elements.backupStatus.dataset.state) elements.backupStatus.textContent = prefs.lastBackupAt
    ? t('backup.lastExport', { date:new Date(prefs.lastBackupAt).toLocaleDateString(prefs.language) })
    : t('backup.private');
}

function exportBackup() {
  save();
  prefs.lastBackupAt = new Date().toISOString();
  savePrefs();
  const payload = createBackupPayload({ prefs, stats, game:state?.status === 'playing' ? state : null }, prefs.lastBackupAt);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `sudodoku-${dateKey()}.sudodoku`; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  elements.backupStatus.dataset.state = 'success';
  elements.backupStatus.textContent = t('backup.exported');
  showToast(t('backup.exported'));
}

async function restoreBackup(file) {
  elements.backupStatus.dataset.state = 'working';
  elements.backupStatus.textContent = t('backup.reading');
  try {
    if (!file || file.size > 2_000_000) throw new Error('size');
    const payload = JSON.parse(await file.text());
    const result = validateBackupPayload(payload);
    if (!result.ok || (result.data.game && !validSavedGame(result.data.game))) throw new Error(result.reason || 'game');
    if (!confirm(t('backup.confirm'))) {
      elements.backupStatus.dataset.state = '';
      elements.backupStatus.textContent = t('backup.cancelled');
      return;
    }
    const restoredPrefs = sanitizeBackupPrefs(result.data.prefs);
    const restoredStats = sanitizeBackupStats(result.data.stats);
    localStorage.setItem(PREFS_KEY, JSON.stringify(restoredPrefs));
    localStorage.setItem(STATS_KEY, JSON.stringify(restoredStats));
    if (result.data.game) localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data.game)); else localStorage.removeItem(STORAGE_KEY);
    elements.backupStatus.dataset.state = 'success';
    elements.backupStatus.textContent = t('backup.restored');
    showToast(t('backup.restored'));
    setTimeout(() => location.reload(), 700);
  } catch {
    elements.backupStatus.dataset.state = 'error';
    elements.backupStatus.textContent = t('backup.invalid');
    showToast(t('backup.invalid'));
  }
}

function populateLanguageSelect(select) {
  if (!select.options.length) {
    LOCALES.forEach(({ code, name }) => {
      const option = document.createElement('option');
      option.value = code; option.textContent = name; select.append(option);
    });
  }
  select.value = prefs.language;
}

function renderLanguageChoices() {
  if (!elements.languageChoiceGrid) return;
  const selectedLocale = LOCALES.find(({ code }) => code === prefs.language) || LOCALES[0];
  elements.languageChoiceGrid.replaceChildren(...LOCALES.map(({ code, name }) => {
    const button = document.createElement('button');
    const codeLabel = document.createElement('span');
    const label = document.createElement('span');
    const check = document.createElement('span');
    button.type = 'button';
    button.className = `language-choice${code === prefs.language ? ' selected' : ''}`;
    button.dataset.language = code;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(code === prefs.language));
    button.setAttribute('aria-label', name);
    codeLabel.className = 'language-choice-code';
    codeLabel.textContent = code.toUpperCase();
    label.className = 'language-choice-label';
    label.textContent = name;
    check.className = 'language-choice-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';
    button.append(codeLabel, label, check);
    button.addEventListener('click', () => {
      setLanguage(code, false);
      requestAnimationFrame(() => elements.languageChoiceGrid.querySelector(`[data-language="${code}"]`)?.focus());
    });
    return button;
  }));
  elements.languageLaunchCurrent.textContent = t('languageLaunch.selected', { language:selectedLocale.name });
}

function applyLocale(refresh = true) {
  applyDocumentTranslations(prefs.language);
  populateLanguageSelect(elements.introLanguage);
  populateLanguageSelect(elements.settingsLanguage);
  renderLanguageChoices();
  elements.languageCode.textContent = prefs.language.toUpperCase();
  elements.settingsButton.setAttribute('aria-label', t('common.settings'));
  elements.statsButton.setAttribute('aria-label', t('common.statistics'));
  elements.soundButton.setAttribute('aria-label', t('common.sound'));
  elements.themeButton.setAttribute('aria-label', t('common.theme'));
  elements.pauseButton.setAttribute('aria-label', t('common.pause'));
  elements.introLanguage.setAttribute('aria-label', t('common.language'));
  elements.settingsLanguage.setAttribute('aria-label', t('common.language'));
  elements.updateDismiss.setAttribute('aria-label', t('pwa.dismiss'));
  elements.homeButton.setAttribute('aria-label', t('mainMenu.open'));
  elements.pwaInstallButtons.forEach((button) => {
    button.setAttribute('aria-label', t('pwa.install'));
    button.title = t('pwa.install');
  });
  if (refresh && state) { render(); updateStatsUI(); }
  if (elements.academyDialog.open) {
    if (academyCurrentLesson === 'rules') renderAcademyRules();
    else renderAcademyLesson();
  }
  if (elements.pwaSummary) void updatePwaUI();
}

function setLanguage(language, announce = true) {
  if (!LOCALES.some(({ code }) => code === language)) return;
  prefs.language = language;
  savePrefs(); applyLocale();
  if (announce) showToast(t('toast.languageSaved'));
}

function initializeMiniBoard() {
  const preview = '000400700406000020000920000700003800030700040005100007000086000090000304002004000';
  elements.miniBoard.replaceChildren(...[...preview].map((value) => {
    const cell = document.createElement('i'); cell.textContent = value === '0' ? '' : value; return cell;
  }));
}

function showIntro() {
  elements.settingsDialog.close();
  closeMainMenu(false);
  const needsLanguageChoice = !prefs.onboarded && !prefs.languageConfirmed;
  elements.languageLaunch.hidden = !needsLanguageChoice;
  elements.introCard.hidden = needsLanguageChoice;
  elements.introScreen.hidden = false;
  document.body.classList.add('onboarding-open');
  requestAnimationFrame(() => {
    if (needsLanguageChoice) elements.languageChoiceGrid.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
    else elements.introLanguage.focus({ preventScroll: true });
  });
}

function confirmLanguageChoice() {
  prefs.languageConfirmed = true;
  savePrefs();
  elements.languageLaunch.hidden = true;
  elements.introCard.hidden = false;
  requestAnimationFrame(() => elements.introStart.focus({ preventScroll: true }));
}

function finishIntro() {
  prefs.onboarded = true; prefs.languageConfirmed = true; savePrefs();
  elements.introScreen.hidden = true;
  document.body.classList.remove('onboarding-open');
  elements.board.querySelector('.cell:not(.given)')?.focus({ preventScroll: true });
}

function haptic(duration = 25) {
  if (prefs.haptics) navigator.vibrate?.(duration);
}

function initializeBoard(size = 9) {
  elements.board.replaceChildren();
  elements.numpad.replaceChildren();
  elements.board.style.setProperty('--size', size);
  elements.board.dataset.size = size;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < size * size; index += 1) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.setAttribute('role', 'gridcell');
    cell.dataset.index = index;
    cell.addEventListener('click', () => selectCell(index));
    fragment.append(cell);
  }
  elements.board.append(fragment);
  cells = [...elements.board.children];

  for (let number = 1; number <= size; number += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'number-button';
    button.textContent = number;
    button.dataset.number = number;
    button.setAttribute('aria-label', `Enter ${number}`);
    button.addEventListener('click', () => enterNumber(number));
    elements.numpad.append(button);
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function render() {
  const size = state.size || 9;
  const boxRows = state.boxRows || 3;
  const boxCols = state.boxCols || 3;
  const selectedValue = state.selected >= 0 ? state.values[state.selected] : 0;
  const peers = state.selected >= 0 ? getPeers(state.selected, state.variant) : new Set();
  elements.board.classList.toggle('killer', state.mode === 'killer');
  elements.board.classList.toggle('hint-active', Boolean(state.lastHint));

  cells.forEach((cell, index) => {
    const value = state.values[index];
    const notes = state.notes[index] || [];
    const row = Math.floor(index / size);
    const col = index % size;
    cell.className = 'cell';
    cell.replaceChildren();
    cell.removeAttribute('aria-describedby');
    if (col === size - 1) cell.classList.add('edge-right');
    if (row === size - 1) cell.classList.add('edge-bottom');
    if ((col + 1) % boxCols === 0) cell.classList.add('box-right');
    if ((row + 1) % boxRows === 0) cell.classList.add('box-bottom');
    if (state.variant === 'hyper' && getHyperRegion(index) >= 0) cell.classList.add('hyper-region', 'hyper-edge');
    if (state.puzzle[index]) cell.classList.add('given');
    else if (value) cell.classList.add('user-value');
    if (index === state.selected) cell.classList.add('selected');
    else if (peers.has(index)) cell.classList.add('related');
    if (selectedValue && value === selectedValue && index !== state.selected) cell.classList.add('same');
    if (state.mode !== 'zen' && value && value !== state.solution[index]) cell.classList.add('error');
    if (state.lastHint?.index === index) cell.classList.add('hint-revealed');
    if (state.lastHint?.cells?.includes(index)) cell.classList.add(state.lastHint.index === index ? 'hint-revealed' : 'hint-pattern');
    if (state.lastHint?.eliminations?.some((item) => item.index === index)) cell.classList.add('hint-elimination');
    if (cell.classList.contains('hint-revealed') || cell.classList.contains('hint-pattern') || cell.classList.contains('hint-elimination')) cell.setAttribute('aria-describedby', 'hintCoach');

    const cage = state.mode === 'killer' ? state.cages?.find((item) => item.cells.includes(index)) : null;
    if (cage) {
      const cageSet = new Set(cage.cells);
      if (!cageSet.has(index - size)) cell.classList.add('cage-top');
      if (col === size - 1 || !cageSet.has(index + 1)) cell.classList.add('cage-right');
      if (row === size - 1 || !cageSet.has(index + size)) cell.classList.add('cage-bottom');
      if (col === 0 || !cageSet.has(index - 1)) cell.classList.add('cage-left');
    }

    if (value) {
      cell.textContent = value;
      cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}, ${value}${state.puzzle[index] ? ', given' : ''}`);
    } else if (notes.length) {
      const grid = document.createElement('span');
      grid.className = 'notes';
      for (let number = 1; number <= size; number += 1) {
        const item = document.createElement('i');
        item.textContent = notes.includes(number) ? number : '';
        grid.append(item);
      }
      cell.append(grid);
      cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}, notes ${notes.join(', ')}`);
    } else {
      cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}, empty`);
    }
    if (cage && index === Math.min(...cage.cells)) { const sum = document.createElement('span'); sum.className = 'cage-sum'; sum.textContent = cage.sum; cell.append(sum); }
    cell.setAttribute('aria-selected', index === state.selected ? 'true' : 'false');
  });

  elements.timer.textContent = state.mode === 'zen' ? '∞' : formatTime(state.seconds);
  elements.mistakes.textContent = state.mistakes;
  elements.hintCount.textContent = state.hints;
  elements.hintButton.disabled = state.hints <= 0;
  elements.autoNotesButton.disabled = state.paused;
  elements.undoButton.disabled = !state.history.length;
  elements.difficultyLabel.textContent = t(`difficulty.${state.difficulty}`);
  elements.modeChip.textContent = t(`mode.${state.mode}`);
  elements.notesButton.classList.toggle('active', state.notesMode);
  elements.notesButton.setAttribute('aria-pressed', state.notesMode);
  elements.notesBadge.textContent = t(state.notesMode ? 'tools.on' : 'tools.off');
  elements.autoNotesButton.classList.toggle('active', state.smartNotesActive);
  elements.autoNotesButton.setAttribute('aria-pressed', state.smartNotesActive);
  elements.autoNotesBadge.textContent = t(state.smartNotesActive ? 'tools.on' : 'tools.off');
  elements.hintCoach.classList.toggle('visible', Boolean(state.lastHint));
  if (state.lastHint) {
    elements.hintCoachTitle.textContent = t(`technique.${state.lastHint.technique}.title`, state.lastHint);
    elements.hintCoachText.textContent = t(`technique.${state.lastHint.technique}.text`, state.lastHint);
  }
  document.body.classList.toggle('paused', state.paused);
  document.body.classList.toggle('zen-mode', state.mode === 'zen');

  const completed = state.values.filter((value, index) => value === state.solution[index]).length;
  const percentage = Math.round((completed / state.values.length) * 100);
  elements.progressPercent.textContent = `${percentage}%`;
  elements.progressText.textContent = t('game.progressOf', { count: completed, total: state.values.length });
  elements.progressRing.style.setProperty('--progress', `${percentage * 3.6}deg`);
  document.querySelectorAll('.number-button').forEach((button) => {
    const number = Number(button.dataset.number);
    const count = state.values.filter((value, index) => value === number && value === state.solution[index]).length;
    button.classList.toggle('completed', count === size);
  });
}

function selectCell(index) {
  if (state.paused || state.status !== 'playing') return;
  state.selected = index;
  tone(420, .025);
  render();
}

function pushHistory() {
  state.history.push({
    values: [...state.values], notes: state.notes.map((note) => [...note]), mistakes: state.mistakes,
    hints: state.hints, hintsUsed: state.hintsUsed, autoNotesUsed: state.autoNotesUsed, smartNotesActive: state.smartNotesActive, manualNotesUsed: state.manualNotesUsed, lastHint: state.lastHint,
  });
  if (state.history.length > 80) state.history.shift();
}

function recordReplay(type, details = {}) {
  state.replay ||= [];
  state.replay.push({ type, seconds: state.seconds, ...details });
}

function enterNumber(number) {
  const index = state.selected;
  if (state.paused || state.status !== 'playing' || index < 0 || state.puzzle[index]) return;
  pushHistory();
  state.lastHint = null;
  if (state.notesMode && !state.values[index]) {
    const note = new Set(state.notes[index]);
    note.has(number) ? note.delete(number) : note.add(number);
    state.notes[index] = [...note].sort();
    state.manualNotesUsed = true;
    tone(520, .035);
  } else {
    if (state.values[index] === number) { state.history.pop(); return; }
    state.values[index] = number;
    state.notes[index] = [];
    if (number !== state.solution[index]) {
      if (state.mode === 'zen') tone(350, .06);
      else {
        state.mistakes += 1;
        tone(145, .12, 'sawtooth');
        cells[index].animate([{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }], { duration: 210, iterations: 2 });
        if (state.mistakes >= 3) { recordReplay('value', { index, value: number }); render(); return endGame(false); }
      }
    } else {
      getPeers(index, state.variant).forEach((peer) => { state.notes[peer] = state.notes[peer].filter((item) => item !== number); });
      tone(620, .055);
    }
    recordReplay('value', { index, value: number });
    if (state.smartNotesActive) refreshSmartNotes();
  }
  render();
  save();
  if (isComplete(state.values, state.solution)) endGame(true);
}

function erase() {
  const index = state.selected;
  if (state.paused || index < 0 || state.puzzle[index] || (!state.values[index] && !state.notes[index].length)) return;
  pushHistory();
  state.lastHint = null;
  state.values[index] = 0;
  state.notes[index] = [];
  if (state.smartNotesActive) refreshSmartNotes();
  recordReplay('erase', { index, value: 0 });
  tone(300, .035);
  render(); save();
}

function undo() {
  if (!state.history.length || state.paused) return;
  const previous = state.history.pop();
  const usage = { hintsUsed: state.hintsUsed, autoNotesUsed: state.autoNotesUsed, manualNotesUsed: state.manualNotesUsed };
  Object.assign(state, previous);
  state.hintsUsed = Math.max(Number(state.hintsUsed || 0), Number(usage.hintsUsed || 0));
  state.autoNotesUsed ||= usage.autoNotesUsed;
  state.manualNotesUsed ||= usage.manualNotesUsed;
  recordReplay('snapshot', { values: [...state.values] });
  tone(360, .045); render(); save();
}

function useHint() {
  if (state.hints <= 0 || state.paused) return;
  const logicalBoard = state.values.map((value, index) => value === state.solution[index] ? value : 0);
  let hint = findTechniqueHint(logicalBoard, state.solution, state.variant);
  if (!hint) return;
  const signature = `${hint.technique}:${(hint.cells || []).join('-')}:${hint.value || (hint.pair || []).join('-')}`;
  state.seenTechniqueSignatures ||= [];
  if (state.seenTechniqueSignatures.includes(signature)) {
    const index = logicalBoard.findIndex((value, position) => value !== state.solution[position]);
    hint = { technique: 'reveal', index, value: state.solution[index], cells: [index], eliminations: [] };
  }
  pushHistory();
  const size = state.size || 9;
  const labelCell = (index) => `R${Math.floor(index / size) + 1}C${(index % size) + 1}`;
  hint.signature = signature;
  hint.row = hint.index >= 0 ? Math.floor(hint.index / size) + 1 : undefined;
  hint.column = hint.index >= 0 ? (hint.index % size) + 1 : undefined;
  hint.cellsLabel = (hint.cells || []).map(labelCell).join(', ');
  hint.targetsLabel = [...new Set((hint.eliminations || []).map((item) => labelCell(item.index)))].slice(0, 4).join(', ');
  hint.pairLabel = hint.pair?.join(' & ');
  hint.valuesLabel = hint.values?.join(', ');
  hint.linesLabel = hint.lines?.join(' & ');
  hint.positionsLabel = hint.positions?.join(' & ');
  if (hint.unitType) hint.unitLabel = t(`unit.${hint.unitType}`, { number: hint.unitNumber });

  if (hint.index >= 0 && hint.value) {
    state.selected = hint.index;
    state.values[hint.index] = hint.value;
    state.notes[hint.index] = [];
    getPeers(hint.index, state.variant).forEach((peer) => { state.notes[peer] = state.notes[peer].filter((item) => item !== hint.value); });
    recordReplay('hint', { index: hint.index, value: hint.value, technique: hint.technique });
  } else {
    const candidateMap = buildCandidateMap(logicalBoard, state.variant);
    candidateMap.forEach((options, index) => { if (!state.values[index]) state.notes[index] = [...options]; });
    hint.eliminations.forEach(({ index, value }) => { state.notes[index] = state.notes[index].filter((candidate) => candidate !== value); });
    state.notesMode = true;
    state.selected = hint.cells[0];
  }
  state.hints -= 1;
  state.hintsUsed = (state.hintsUsed || 0) + 1;
  if (hint.technique !== 'reveal') {
    const level = playerLevel();
    stats.logicalHints = Number(stats.logicalHints || 0) + 1;
    if (!stats.techniquesDiscovered.includes(hint.technique)) stats.techniquesDiscovered.push(hint.technique);
    const unlocked = unlockAchievements();
    saveStats();
    if (unlocked.length) {
      updateStatsUI();
      queueProgressEvents(progressionEvents(unlocked, level, level, []));
    }
  }
  state.lastHint = hint;
  state.seenTechniqueSignatures.push(signature);
  render();
  const highlightedCell = cells[hint.index >= 0 ? hint.index : hint.cells[0]];
  highlightedCell?.focus({ preventScroll: true });
  highlightedCell?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  haptic(35);
  tone(720, .08); save();
  if (isComplete(state.values, state.solution)) endGame(true);
}

function refreshSmartNotes() {
  let filled = 0;
  state.values.forEach((value, index) => {
    if (value) { state.notes[index] = []; return; }
    const options = getCandidates(state.values, index, state.variant);
    state.notes[index] = options;
    filled += options.length;
  });
  return filled;
}

function toggleSmartNotes() {
  if (state.paused || state.status !== 'playing') return;
  pushHistory();
  state.lastHint = null;
  if (state.smartNotesActive) {
    state.smartNotesActive = false;
    state.notes = state.notes.map(() => []);
    showToast(t('toast.smartNotesOff'));
  } else {
    state.smartNotesActive = true;
    state.autoNotesUsed = true;
    state.notesMode = false;
    const filled = refreshSmartNotes();
    showToast(t('toast.smartNotesOn', { count:filled }));
  }
  haptic(20);
  tone(state.smartNotesActive ? 600 : 330, .07); render(); save();
}

function dismissHint() {
  state.lastHint = null;
  render(); save();
}

function setPaused(paused) {
  if (state.status !== 'playing') return;
  state.paused = paused;
  render(); save();
}

function toggleNotes() {
  if (state.paused) return;
  state.notesMode = !state.notesMode;
  tone(state.notesMode ? 560 : 350, .04); render(); save();
}

function updateStreak() {
  const today = new Date();
  const todayKey = dateKey(today);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = dateKey(yesterday);
  if (stats.lastWin !== todayKey) stats.streak = stats.lastWin === yesterdayKey ? stats.streak + 1 : 1;
  stats.lastWin = todayKey;
  stats.maxDailyStreak = Math.max(Number(stats.maxDailyStreak || 0), stats.streak);
}

function focusScore() {
  const base = { easy: 1000, medium: 1400, hard: 1900, expert: 2500 }[state.difficulty];
  const modeMultiplier = { classic: 1, daily: 1.1, killer: 1.2, hyper: 1.25, mini: .65, zen: .8 }[state.mode] || 1;
  const timePenalty = state.mode === 'zen' ? 0 : Math.min(state.seconds * 2, base * .55);
  const penalty = timePenalty + state.mistakes * 180 + (state.hintsUsed || 0) * 120 + (state.autoNotesUsed ? 90 : 0);
  return Math.max(100, Math.round((base - penalty) * modeMultiplier));
}

function playerLevel() { return levelFromPoints(stats.points); }

function weekKey() {
  const date = new Date();
  const first = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date - first) / 86400000) + first.getDay() + 1) / 7);
  return `${date.getFullYear()}-${week}`;
}

function ensureWeeklyQuest() {
  const key = weekKey();
  if (stats.weekly?.key === key) return stats.weekly;
  const weekNumber = Number(key.split('-')[1]);
  const questIds = ['complete', 'logic', 'variants', 'daily'];
  stats.weekly = { key, questId: questIds[weekNumber % questIds.length], completedGames: 0, noHintWins: 0, variantWins: 0, dailyWins: 0, claimed: false };
  return stats.weekly;
}

function weeklyQuestDefinition() {
  const weekly = ensureWeeklyQuest();
  return {
    complete: { target: 3, field: 'completedGames' },
    logic: { target: 2, field: 'noHintWins' },
    variants: { target: 2, field: 'variantWins' },
    daily: { target: 2, field: 'dailyWins' },
  }[weekly.questId];
}

function recordWeeklyWin() {
  const weekly = ensureWeeklyQuest();
  weekly.completedGames += 1;
  if (!state.hintsUsed && !state.autoNotesUsed) weekly.noHintWins += 1;
  if (['killer', 'hyper', 'mini'].includes(state.mode)) weekly.variantWins += 1;
  if (state.mode === 'daily') weekly.dailyWins += 1;
  const quest = weeklyQuestDefinition();
  if (!weekly.claimed && weekly[quest.field] >= quest.target) {
    weekly.claimed = true;
    stats.weeklyQuests = Number(stats.weeklyQuests || 0) + 1;
    stats.points += 500;
    return true;
  }
  return false;
}

function updateProgressionUI() {
  const level = playerLevel();
  elements.levelBadge.textContent = t('progress.level', { level });
  const weekly = ensureWeeklyQuest();
  const quest = weeklyQuestDefinition();
  const progress = Math.min(weekly[quest.field], quest.target);
  elements.questTitle.textContent = t(`quest.${weekly.questId}.title`);
  elements.questDescription.textContent = t(`quest.${weekly.questId}.text`, { target: quest.target });
  elements.questProgress.style.width = `${(progress / quest.target) * 100}%`;
  elements.questCount.textContent = `${progress} / ${quest.target}`;
  elements.questReward.textContent = weekly.claimed ? t('quest.claimed') : '+500 XP';
}

function achievementProgress(achievement) {
  const current = Math.max(0, Number(achievement.progress(stats) || 0));
  return { current, target: achievement.target, complete: current >= achievement.target };
}

function unlockAchievements() {
  const unlocked = ACHIEVEMENTS
    .filter((achievement) => achievementProgress(achievement).complete && !stats.achievements.includes(achievement.id))
    .map((achievement) => achievement.id);
  stats.achievements.push(...unlocked);
  const unlockedAt = new Date().toISOString();
  stats.achievementHistory.unshift(...unlocked.map((id) => ({ id, unlockedAt })));
  stats.achievementHistory = stats.achievementHistory.slice(0, 100);
  return unlocked;
}

function collectNearAchievements() {
  const near = ACHIEVEMENTS.filter((achievement) => {
    if (achievement.secret || stats.achievements.includes(achievement.id) || stats.nearNotified.includes(achievement.id) || achievement.target <= 1) return false;
    const { current } = achievementProgress(achievement);
    return current >= achievement.target * .8 && current < achievement.target;
  }).slice(0, 2);
  stats.nearNotified.push(...near.map(({ id }) => id));
  return near;
}

function queueProgressEvents(events) {
  events.forEach((event, eventIndex) => setTimeout(() => {
    const card = document.createElement('article');
    card.className = `progress-event ${event.className || ''}`;
    const icon = document.createElement('span'); icon.className = 'progress-event-icon'; icon.textContent = event.icon || '◆';
    if (event.color) card.style.setProperty('--event-color', event.color);
    const copy = document.createElement('div');
    const label = document.createElement('small'); label.textContent = event.label;
    const title = document.createElement('strong'); title.textContent = event.title;
    const description = document.createElement('p'); description.textContent = event.description;
    copy.append(label, title, description); card.append(icon, copy); elements.progressEventStack.append(card);
    requestAnimationFrame(() => card.classList.add('show'));
    setTimeout(() => { card.classList.remove('show'); setTimeout(() => card.remove(), 400); }, 5200);
  }, eventIndex * 650));
}

function progressionEvents(unlocked, levelBefore, levelAfter, near) {
  const achievementEvents = unlocked.map((id) => {
    const achievement = ACHIEVEMENTS.find((item) => item.id === id);
    return { className:`tier-${achievement.tier}`, icon:'◆', label:t('achievement.unlockedEvent'), title:t(`achievement.${id}`), description:t(`achievement.${id}.desc`) };
  });
  const customizationEvents = [
    ...THEME_PACKS.filter(({ level }) => level > levelBefore && level <= levelAfter).map((item) => ({ ...item, kind:'theme' })),
    ...BOARD_STYLES.filter(({ level }) => level > levelBefore && level <= levelAfter).map((item) => ({ ...item, kind:'style' })),
  ].map((item) => ({ className:'theme-event', icon:'✦', color:item.color, label:t('achievement.styleUnlocked'), title:t(`${item.kind}.${item.id}`), description:t('progress.level', { level:item.level }) }));
  const nearEvents = near.map((achievement) => {
    const progress = achievementProgress(achievement);
    return { className:`tier-${achievement.tier}`, icon:'◇', label:t('achievement.almostThere'), title:t(`achievement.${achievement.id}`), description:t('achievement.progressEvent', { current:Math.floor(progress.current), target:achievement.target }) };
  });
  return [...achievementEvents, ...customizationEvents, ...nearEvents];
}

function recordLifetimeResult(won) {
  stats.totalSeconds = Number(stats.totalSeconds || 0) + state.seconds;
  stats.totalMistakes = Number(stats.totalMistakes || 0) + state.mistakes;
  stats.totalHints = Number(stats.totalHints || 0) + Number(state.hintsUsed || 0);
  if (!won) {
    stats.currentPerfectStreak = 0;
    return;
  }
  stats.modeWins[state.mode] = modeWins(stats, state.mode) + 1;
  const hour = new Date().getHours();
  if (hour < 5) stats.nightWins = Number(stats.nightWins || 0) + 1;
  if (state.mistakes === 2) stats.closeCallWins = Number(stats.closeCallWins || 0) + 1;
  if (['hard','expert'].includes(state.difficulty) && !state.hintsUsed && !state.autoNotesUsed && !state.manualNotesUsed) stats.noPencilWins = Number(stats.noPencilWins || 0) + 1;
  if (state.mode !== 'zen' && state.seconds >= 2700 && !state.hintsUsed) stats.patientWins = Number(stats.patientWins || 0) + 1;
  if (state.mode !== 'zen') {
    const modeBest = stats.bestByMode[state.mode];
    if (!Number.isFinite(modeBest) || state.seconds < modeBest) stats.bestByMode[state.mode] = state.seconds;
  }
  if (state.mistakes === 0) {
    stats.perfectWins = Number(stats.perfectWins || 0) + 1;
    stats.currentPerfectStreak = Number(stats.currentPerfectStreak || 0) + 1;
    stats.bestPerfectStreak = Math.max(Number(stats.bestPerfectStreak || 0), stats.currentPerfectStreak);
  } else stats.currentPerfectStreak = 0;
  if (!state.hintsUsed && !state.autoNotesUsed) stats.pureLogicWins = Number(stats.pureLogicWins || 0) + 1;
  if (state.difficulty === 'expert') {
    stats.expertWins = Number(stats.expertWins || 0) + 1;
    if (!state.hintsUsed && !state.autoNotesUsed) stats.expertPureWins = Number(stats.expertPureWins || 0) + 1;
  }
}

function endGame(won) {
  const levelBefore = playerLevel();
  state.status = won ? 'won' : 'lost';
  state.paused = true;
  localStorage.removeItem(STORAGE_KEY);
  recordLifetimeResult(won);
  if (won) {
    stats.won += 1;
    if (state.mode === 'daily') {
      updateStreak();
      if (!stats.dailyCompleted.includes(state.dailyDate)) stats.dailyCompleted.push(state.dailyDate);
    }
    const best = stats.best[state.difficulty];
    if (state.mode !== 'zen' && (!Number.isFinite(best) || state.seconds < best)) stats.best[state.difficulty] = state.seconds;
    const score = focusScore();
    stats.points += score;
    const questCompleted = recordWeeklyWin();
    const unlocked = unlockAchievements();
    const near = collectNearAchievements();
    const events = progressionEvents(unlocked, levelBefore, playerLevel(), near);
    elements.dialogEyebrow.textContent = t(state.mode === 'daily' ? 'result.dailyComplete' : 'result.complete');
    elements.dialogTitle.textContent = t(state.mistakes === 0 ? 'result.flawless' : 'result.beautiful');
    elements.dialogText.textContent = t(state.mode === 'daily' ? 'result.dailyText' : 'result.completeText');
    elements.resultGrid.hidden = false;
    elements.resultTime.textContent = formatTime(state.seconds);
    elements.resultMistakes.textContent = state.mistakes;
    elements.resultScore.textContent = score.toLocaleString();
    elements.shareResultButton.hidden = false;
    elements.unlockBanner.hidden = !unlocked.length && !questCompleted;
    if (unlocked.length > 1) elements.unlockText.textContent = t('achievement.multiple', { count: unlocked.length });
    else if (unlocked.length) elements.unlockText.textContent = t(`achievement.${unlocked[0]}`) || t('achievement.new');
    else if (questCompleted) elements.unlockText.textContent = t('quest.completeReward');
    celebratoryTones();
    launchConfetti();
    if (events.length) queueProgressEvents(events);
  } else {
    elements.dialogEyebrow.textContent = t('result.gameOver');
    elements.dialogTitle.textContent = t('result.almost');
    elements.dialogText.textContent = t('result.failedText');
    elements.resultGrid.hidden = true;
    elements.shareResultButton.hidden = true;
    elements.unlockBanner.hidden = true;
  }
  saveStats(); updateStatsUI();
  setTimeout(() => elements.dialog.showModal(), 300);
}

function startNewGame(difficulty = state?.difficulty || 'medium', options = {}) {
  closeMainMenu(false);
  elements.dialog.close(); elements.statsDialog.close();
  showToast(t('toast.creating'));
  requestAnimationFrame(() => setTimeout(() => {
    state = freshState(difficulty, options);
    initializeBoard(state.size);
    stats.played += 1;
    saveStats(); save(); render(); updateStatsUI();
    showToast(options.mode === 'daily' ? t('toast.dailyReady') : t('toast.puzzleReady', { difficulty: t(`difficulty.${difficulty}`) }));
  }, 20));
}

function startDailyGame() {
  const daily = dailyConfig();
  startNewGame(daily.difficulty, { mode: 'daily', seed: daily.seed, dailyDate: daily.date });
}

function startModeGame(mode) {
  const variant = mode === 'hyper' ? 'hyper' : mode === 'mini' ? 'mini' : 'classic';
  startNewGame(state?.difficulty || 'medium', { mode, variant });
}

function updateMainMenu() {
  if (!state) return;
  const completed = state.values.filter((value, index) => value === state.solution[index]).length;
  const percent = Math.round((completed / state.values.length) * 100);
  const playable = state.status === 'playing';
  elements.menuContinueButton.querySelector('small').textContent = t(playable ? 'mainMenu.continue' : 'mainMenu.startFresh');
  elements.menuContinueTitle.textContent = playable ? `${t(`mode.${state.mode}`)} · ${t(`difficulty.${state.difficulty}`)}` : t('mode.classic');
  elements.menuContinueProgress.textContent = playable ? t('mainMenu.progress', { percent }) : t('mainMenu.ready');
  elements.menuLevel.textContent = t('progress.level', { level:playerLevel() });
  elements.menuPoints.textContent = Number(stats.points || 0).toLocaleString();
  elements.menuAchievements.textContent = stats.achievements.length;
  elements.menuLessons.textContent = `${stats.academyCompleted.length} / ${ACADEMY_LESSONS.length}`;
}

function openMainMenu(event) {
  event?.preventDefault();
  if (!elements.introScreen.hidden || !elements.mainMenu.hidden) return;
  if (state.status === 'playing') { state.paused = true; render(); save(); }
  updateMainMenu();
  elements.mainMenu.hidden = false;
  document.body.classList.add('main-menu-open');
  elements.mainMenu.scrollTop = 0;
  requestAnimationFrame(() => elements.menuContinueButton.focus({ preventScroll:true }));
}

function closeMainMenu(resume = true) {
  if (!elements.mainMenu || elements.mainMenu.hidden) return;
  elements.mainMenu.hidden = true;
  document.body.classList.remove('main-menu-open');
  if (resume && state?.status === 'playing') { state.paused = false; render(); save(); }
}

function continueFromMainMenu() {
  if (state.status === 'playing') closeMainMenu(true);
  else startModeGame('classic');
}

function updateAcademyProgressUI() {
  const completed = stats.academyCompleted.length;
  elements.academyCardProgress.textContent = t('academy.progress', { completed, total:ACADEMY_LESSONS.length });
  elements.academySettingsProgress.textContent = `${completed} / ${ACADEMY_LESSONS.length}`;
  elements.academyCompleteCount.textContent = `${completed} / ${ACADEMY_LESSONS.length}`;
  elements.academyProgressBar.style.width = `${(completed / ACADEMY_LESSONS.length) * 100}%`;
}

function renderAcademyLessonList() {
  const rulesButton = document.createElement('button');
  rulesButton.type = 'button'; rulesButton.dataset.academyRules = '';
  rulesButton.className = `academy-rules-link${academyCurrentLesson === 'rules' ? ' active' : ''}`;
  const rulesIcon = document.createElement('span'); rulesIcon.textContent = '?';
  const rulesCopy = document.createElement('div');
  const rulesLabel = document.createElement('small'); rulesLabel.textContent = t('academy.rules.short');
  const rulesTitle = document.createElement('strong'); rulesTitle.textContent = t('academy.rules.nav');
  rulesCopy.append(rulesLabel, rulesTitle);
  const rulesStatus = document.createElement('em'); rulesStatus.textContent = '›';
  rulesButton.append(rulesIcon, rulesCopy, rulesStatus);

  const lessonButtons = ACADEMY_LESSONS.map((lesson, lessonIndex) => {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.lesson = lesson.id;
    button.className = `${lesson.id === academyCurrentLesson ? 'active ' : ''}${stats.academyCompleted.includes(lesson.id) ? 'complete' : ''}`.trim();
    const icon = document.createElement('span'); icon.textContent = lesson.icon;
    const copy = document.createElement('div');
    const number = document.createElement('small'); number.textContent = t('academy.lessonNumber', { number:lessonIndex + 1 });
    const title = document.createElement('strong'); title.textContent = t(`academy.${lesson.id}.title`);
    copy.append(number, title);
    const status = document.createElement('em'); status.textContent = stats.academyCompleted.includes(lesson.id) ? '✓' : '›';
    button.append(icon, copy, status); return button;
  });
  elements.academyLessonList.replaceChildren(rulesButton, ...lessonButtons);
}

function renderAcademyRules() {
  academyCurrentLesson = 'rules';
  renderAcademyLessonList(); updateAcademyProgressUI();
  elements.academyStage.classList.add('show-rules');
  elements.academyRules.hidden = false;
}

function renderAcademyLesson(id = academyCurrentLesson) {
  academyCurrentLesson = ACADEMY_LESSONS.some((lesson) => lesson.id === id) ? id : ACADEMY_LESSONS[0].id;
  const lesson = getAcademyLesson(academyCurrentLesson);
  renderAcademyLessonList(); updateAcademyProgressUI();
  elements.academyStage.classList.remove('show-rules');
  elements.academyRules.hidden = true;
  elements.academyLessonLevel.textContent = t(`academy.level.${lesson.level}`);
  elements.academyLessonReward.textContent = stats.academyCompleted.includes(lesson.id) ? t('academy.masteredLabel') : `+${lesson.reward} XP`;
  elements.academyLessonTitle.textContent = t(`academy.${lesson.id}.title`);
  elements.academyLessonIntro.textContent = t(`academy.${lesson.id}.intro`);
  elements.academySteps.replaceChildren(...[1,2,3].map((stepNumber) => {
    const item = document.createElement('li');
    const number = document.createElement('span'); number.textContent = stepNumber;
    const text = document.createElement('p'); text.textContent = t(`academy.${lesson.id}.step${stepNumber}`);
    item.append(number, text); return item;
  }));
  elements.academyQuestion.textContent = t(`academy.${lesson.id}.question`);
  elements.academyFeedback.textContent = '';
  elements.academyFeedback.className = '';
  elements.academyNextButton.hidden = true;

  const patternCells = new Set(lesson.hint.cells || []);
  const eliminationCells = new Set((lesson.hint.eliminations || []).map(({ index }) => index));
  elements.academyBoard.replaceChildren(...lesson.board.map((value, index) => {
    const cell = document.createElement('div');
    cell.className = `academy-cell${value ? ' given' : ''}${patternCells.has(index) ? ' pattern-cell' : ''}${eliminationCells.has(index) ? ' elimination-cell' : ''}`;
    if (value) cell.textContent = value;
    else {
      const candidates = document.createElement('div'); candidates.className = 'academy-candidates';
      for (let candidate = 1; candidate <= 9; candidate += 1) {
        const mark = document.createElement('span');
        if (lesson.candidates[index].includes(candidate)) mark.textContent = candidate;
        const isPattern = patternCells.has(index) && (lesson.hint.value === candidate || lesson.hint.pair?.includes(candidate) || lesson.hint.values?.includes(candidate));
        const isElimination = lesson.hint.eliminations?.some((item) => item.index === index && item.value === candidate);
        if (isPattern) mark.classList.add('pattern');
        if (isElimination) mark.classList.add('elimination');
        candidates.append(mark);
      }
      cell.append(candidates);
    }
    const row = Math.floor(index / 9) + 1; const column = (index % 9) + 1;
    cell.setAttribute('aria-label', value ? `R${row}C${column}: ${value}` : `R${row}C${column}: ${lesson.candidates[index].join(', ')}`);
    return cell;
  }));
  elements.academyChoices.replaceChildren(...lesson.choices.map((choice) => {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.answer = choice; button.textContent = choice;
    return button;
  }));
}

function answerAcademyQuestion(event) {
  const button = event.target.closest('[data-answer]');
  if (!button) return;
  if (!isAcademyAnswer(academyCurrentLesson, button.dataset.answer)) {
    button.classList.add('wrong');
    elements.academyFeedback.className = 'wrong';
    elements.academyFeedback.textContent = t('academy.tryAgain');
    haptic(20); tone(180, .06, 'sawtooth');
    return;
  }
  const lesson = ACADEMY_LESSONS.find(({ id }) => id === academyCurrentLesson);
  button.classList.add('correct');
  elements.academyChoices.querySelectorAll('button').forEach((choice) => { choice.disabled = true; });
  elements.academyFeedback.className = 'correct';
  elements.academyFeedback.textContent = t(`academy.${lesson.id}.success`);
  elements.academyNextButton.hidden = false;
  if (!stats.academyCompleted.includes(lesson.id)) {
    const levelBefore = playerLevel();
    stats.academyCompleted.push(lesson.id);
    if (!stats.techniquesDiscovered.includes(lesson.id)) stats.techniquesDiscovered.push(lesson.id);
    stats.points += lesson.reward;
    const unlocked = unlockAchievements();
    const events = [
      { className:'theme-event', icon:lesson.icon, label:t('academy.lessonComplete'), title:t(`academy.${lesson.id}.title`), description:t('academy.reward', { points:lesson.reward }) },
      ...progressionEvents(unlocked, levelBefore, playerLevel(), []),
    ];
    pendingAcademyEvents.push(...events);
    saveStats(); updateStatsUI(); renderAcademyLessonList();
  }
  haptic(35); tone(720, .1);
}

function openAcademy() {
  if (elements.settingsDialog.open) elements.settingsDialog.close();
  const firstIncomplete = ACADEMY_LESSONS.find((lesson) => !stats.academyCompleted.includes(lesson.id));
  if (!prefs.academyRulesSeen) renderAcademyRules();
  else {
    academyCurrentLesson = firstIncomplete?.id || academyCurrentLesson;
    renderAcademyLesson();
  }
  elements.academyDialog.showModal();
}

function beginAcademyLessons() {
  prefs.academyRulesSeen = true;
  savePrefs();
  const firstIncomplete = ACADEMY_LESSONS.find((lesson) => !stats.academyCompleted.includes(lesson.id));
  renderAcademyLesson(firstIncomplete?.id || ACADEMY_LESSONS[0].id);
}

function nextAcademyLesson() {
  const index = ACADEMY_LESSONS.findIndex(({ id }) => id === academyCurrentLesson);
  renderAcademyLesson(ACADEMY_LESSONS[(index + 1) % ACADEMY_LESSONS.length].id);
}

function updateStatsUI() {
  const winRate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  elements.statPlayed.textContent = stats.played;
  elements.statWon.textContent = `${winRate}%`;
  elements.statStreak.textContent = stats.streak;
  const bestValues = Object.values(stats.best || {}).filter(Number.isFinite);
  elements.statBest.textContent = bestValues.length ? formatTime(Math.min(...bestValues)) : '—';
  elements.statPoints.textContent = Number(stats.points || 0).toLocaleString();
  elements.statDaily.textContent = stats.dailyCompleted.length;
  const streakLabel = t(stats.streak === 1 ? 'daily.streak' : 'daily.streakPlural', { count: stats.streak });
  const completedToday = stats.dailyCompleted.includes(dateKey());
  elements.dailyTitle.textContent = t(completedToday ? 'daily.complete' : 'daily.today');
  elements.dailySubtitle.textContent = `${streakLabel} · ${t(completedToday ? 'daily.replay' : 'daily.play')}`;
  const unlockedCount = ACHIEVEMENTS.filter((achievement) => stats.achievements.includes(achievement.id)).length;
  elements.achievementCount.textContent = `${unlockedCount} / ${ACHIEVEMENTS.length}`;
  elements.achievementList.replaceChildren(...ACHIEVEMENTS.map((achievement) => {
    const unlocked = stats.achievements.includes(achievement.id);
    const concealed = achievement.secret && !unlocked;
    const progress = achievementProgress(achievement);
    const displayCurrent = achievement.format === 'hours' ? Math.floor(progress.current / 3600) : Math.min(progress.current, progress.target);
    const displayTarget = achievement.format === 'hours' ? Math.floor(progress.target / 3600) : progress.target;
    const card = document.createElement('article');
    card.className = `achievement-card tier-${achievement.tier}${unlocked ? ' unlocked' : ' locked'}${achievement.secret ? ' secret' : ''}`;
    const visibleName = t(concealed ? 'achievement.secret' : `achievement.${achievement.id}`);
    const visibleDescription = t(concealed ? 'achievement.secret.desc' : `achievement.${achievement.id}.desc`);
    card.setAttribute('aria-label', `${visibleName}. ${visibleDescription}`);
    const icon = document.createElement('span'); icon.className = 'achievement-icon'; icon.textContent = unlocked ? '◆' : concealed ? '?' : '◇';
    const copy = document.createElement('div');
    const head = document.createElement('div');
    const name = document.createElement('strong'); name.textContent = visibleName;
    const tier = document.createElement('em'); tier.textContent = t(`achievement.tier.${concealed ? 'secret' : achievement.tier}`);
    head.append(name, tier);
    const description = document.createElement('p'); description.textContent = visibleDescription;
    const meter = document.createElement('div'); meter.className = 'achievement-meter';
    const fill = document.createElement('i'); fill.style.width = unlocked ? '100%' : `${Math.min(100, (progress.current / progress.target) * 100)}%`; meter.append(fill);
    const count = document.createElement('small'); count.textContent = unlocked ? t('achievement.completed') : concealed ? t('achievement.hidden') : `${displayCurrent.toLocaleString()} / ${displayTarget.toLocaleString()}${achievement.format === 'hours' ? ` ${t('achievement.hours')}` : ''}`;
    copy.append(head, description, meter, count); card.append(icon, copy);
    return card;
  }));
  elements.achievementHistoryCount.textContent = t('achievement.historyCount', { count:stats.achievementHistory.length });
  if (!stats.achievementHistory.length) {
    const empty = document.createElement('p'); empty.className = 'history-empty'; empty.textContent = t('achievement.historyEmpty');
    elements.achievementHistoryList.replaceChildren(empty);
  } else {
    elements.achievementHistoryList.replaceChildren(...stats.achievementHistory.slice(0, 20).map((entry) => {
      const achievement = ACHIEVEMENTS.find(({ id }) => id === entry.id);
      if (!achievement) return document.createDocumentFragment();
      const row = document.createElement('div'); row.className = `history-entry tier-${achievement.tier}`;
      const icon = document.createElement('span'); icon.textContent = '◆';
      const copy = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = t(`achievement.${achievement.id}`);
      const date = document.createElement('small'); date.textContent = new Date(entry.unlockedAt).toLocaleDateString(prefs.language, { year:'numeric', month:'short', day:'numeric' });
      const tier = document.createElement('em'); tier.textContent = t(`achievement.tier.${achievement.tier}`);
      copy.append(name, date); row.append(icon, copy, tier); return row;
    }));
  }
  updateProgressionUI();
  renderCustomizationOptions();
  updateAcademyProgressUI();
  updateBackupUI();
  updateMainMenu();
}

function buildReplayFrames() {
  const values = [...state.puzzle];
  const frames = [{ values: [...values], caption: t('replay.start'), seconds: 0 }];
  (state.replay || []).forEach((move, moveIndex) => {
    if (move.type === 'snapshot') move.values.forEach((value, index) => { values[index] = value; });
    else if (Number.isInteger(move.index)) values[move.index] = move.value;
    frames.push({ values: [...values], seconds: move.seconds, caption: t(`replay.${move.type}`, { step: moveIndex + 1, value: move.value ?? '' }) });
  });
  return frames;
}

function renderReplayFrame(step) {
  const frame = replayFrames[step];
  if (!frame) return;
  const size = state.size || 9;
  elements.replayBoard.style.setProperty('--size', size);
  elements.replayBoard.replaceChildren(...frame.values.map((value, index) => {
    const cell = document.createElement('i'); cell.textContent = value || '';
    if (!state.puzzle[index] && value) cell.classList.add('user');
    return cell;
  }));
  elements.replayRange.value = step;
  elements.replayStep.textContent = `${step} / ${replayFrames.length - 1}`;
  elements.replayCaption.textContent = `${formatTime(frame.seconds)} · ${frame.caption}`;
}

function openReplay() {
  clearInterval(replayTimer);
  replayTimer = null;
  replayFrames = buildReplayFrames();
  elements.replayRange.max = replayFrames.length - 1;
  elements.dialog.close();
  renderReplayFrame(0);
  setReplayPlaying(false);
  elements.replayDialog.showModal();
}

function setReplayPlaying(playing) {
  elements.replayPlay.classList.toggle('playing', playing);
  elements.replayPlay.setAttribute('aria-label', t(playing ? 'replay.pause' : 'replay.play'));
}

function toggleReplay() {
  if (replayTimer) { clearInterval(replayTimer); replayTimer = null; setReplayPlaying(false); return; }
  if (Number(elements.replayRange.value) >= replayFrames.length - 1) renderReplayFrame(0);
  setReplayPlaying(true);
  replayTimer = setInterval(() => {
    const next = Number(elements.replayRange.value) + 1;
    if (next >= replayFrames.length) { clearInterval(replayTimer); replayTimer = null; setReplayPlaying(false); return; }
    renderReplayFrame(next);
  }, 600);
}

function createResultCardBlob() {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1080;
    const context = canvas.getContext('2d');
    const computed = getComputedStyle(document.documentElement);
    const accent = computed.getPropertyValue('--accent').trim() || '#6d5dfc';
    const gradient = context.createLinearGradient(0, 0, 1080, 1080); gradient.addColorStop(0, '#171421'); gradient.addColorStop(1, accent);
    context.fillStyle = gradient; context.fillRect(0, 0, 1080, 1080);
    context.fillStyle = 'rgba(255,255,255,.08)'; context.beginPath(); context.arc(900, 130, 330, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#fff'; context.font = '700 54px Segoe UI'; context.fillText('Sudodoku', 90, 100);
    context.font = '700 82px Segoe UI'; context.fillText(t('share.cardTitle'), 90, 205);
    context.fillStyle = 'rgba(255,255,255,.72)'; context.font = '500 30px Segoe UI';
    context.fillText(`${t(`mode.${state.mode}`)} · ${t(`difficulty.${state.difficulty}`)}`, 92, 265);
    const statsLine = `${formatTime(state.seconds)}   •   ${focusScore().toLocaleString()} ${t('result.score')}`;
    context.fillText(statsLine, 92, 320);
    const size = state.size || 9; const gridSize = 630; const cellSize = gridSize / size; const startX = 225; const startY = 375;
    context.fillStyle = 'rgba(255,255,255,.95)'; context.fillRect(startX, startY, gridSize, gridSize);
    context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = `700 ${Math.floor(cellSize * .48)}px Segoe UI`;
    state.solution.forEach((value, index) => {
      const row = Math.floor(index / size); const col = index % size;
      context.fillStyle = state.puzzle[index] ? '#272238' : accent;
      context.fillText(value, startX + col * cellSize + cellSize / 2, startY + row * cellSize + cellSize / 2);
    });
    context.strokeStyle = '#d8d3e4'; context.lineWidth = 2;
    for (let line = 0; line <= size; line += 1) { context.beginPath(); context.moveTo(startX + line * cellSize, startY); context.lineTo(startX + line * cellSize, startY + gridSize); context.stroke(); context.beginPath(); context.moveTo(startX, startY + line * cellSize); context.lineTo(startX + gridSize, startY + line * cellSize); context.stroke(); }
    context.strokeStyle = '#4b445b'; context.lineWidth = 6;
    const { boxRows, boxCols } = state;
    for (let line = 0; line <= size; line += boxCols) { context.beginPath(); context.moveTo(startX + line * cellSize, startY); context.lineTo(startX + line * cellSize, startY + gridSize); context.stroke(); }
    for (let line = 0; line <= size; line += boxRows) { context.beginPath(); context.moveTo(startX, startY + line * cellSize); context.lineTo(startX + gridSize, startY + line * cellSize); context.stroke(); }
    context.textAlign = 'left'; context.fillStyle = 'rgba(255,255,255,.65)'; context.font = '500 24px Segoe UI'; context.fillText(t('share.cardFooter'), 90, 1040);
    canvas.toBlob(resolve, 'image/png');
  });
}

async function shareResult() {
  const text = t('share.text', {
    difficulty: t(`difficulty.${state.difficulty}`), time: formatTime(state.seconds),
    mistakes: state.mistakes, score: focusScore().toLocaleString(),
  });
  try {
    const blob = await createResultCardBlob();
    const file = blob ? new File([blob], 'sudodoku-result.png', { type: 'image/png' }) : null;
    if (navigator.share && file && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title: t('share.title'), text, files: [file] });
      showToast(t('toast.shared'));
    } else if (navigator.share) {
      await navigator.share({ title: t('share.title'), text });
      showToast(t('toast.shared'));
    } else if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `sudodoku-${dateKey()}.png`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      navigator.clipboard?.writeText(text).catch(() => {});
      showToast(t('toast.cardSaved'));
    } else {
      await navigator.clipboard.writeText(text);
      showToast(t('toast.copied'));
    }
  } catch (error) {
    if (error?.name !== 'AbortError') showToast(text);
  }
}

function showToast(message) {
  clearTimeout(toastId);
  const openDialog = [...document.querySelectorAll('dialog[open]')].at(-1);
  if (openDialog) openDialog.append(elements.toast);
  else if (elements.toast.parentElement !== document.body) document.body.append(elements.toast);
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  toastId = setTimeout(() => {
    elements.toast.classList.remove('show');
    setTimeout(() => { if (!elements.toast.classList.contains('show') && elements.toast.parentElement !== document.body) document.body.append(elements.toast); }, 260);
  }, 1900);
}

function tone(frequency, duration, type = 'sine') {
  if (!prefs.sound) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = frequency; oscillator.type = type;
    gain.gain.setValueAtTime(.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Sound is an enhancement. */ }
}

function celebratoryTones() {
  [523, 659, 784].forEach((frequency, index) => setTimeout(() => tone(frequency, .22), index * 120));
}

function launchConfetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#6d5dfc', '#f5bf4f', '#46b98a', '#e76176', '#9b8cff'];
  for (let index = 0; index < 42; index += 1) {
    const piece = document.createElement('i');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[index % colors.length];
    piece.style.setProperty('--fall', `${2 + Math.random() * 1.8}s`);
    piece.style.setProperty('--drift', `${-90 + Math.random() * 180}px`);
    piece.style.animationDelay = `${Math.random() * .45}s`;
    document.body.append(piece);
    setTimeout(() => piece.remove(), 4300);
  }
}

function applyPrefs() {
  document.documentElement.dataset.theme = prefs.theme;
  document.documentElement.dataset.sound = prefs.sound ? 'on' : 'off';
  document.documentElement.dataset.palette = prefs.palette || 'lavender';
  document.documentElement.dataset.boardStyle = prefs.boardStyle || 'classic';
  document.querySelector('meta[name="theme-color"]').content = prefs.theme === 'dark' ? '#15131e' : '#6d5dfc';
  elements.hapticsToggle.checked = prefs.haptics;
  elements.autoPauseToggle.checked = prefs.autoPause;
  applyLocale(false);
}

function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function messageServiceWorker(worker, type) {
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => resolve(null), 1800);
    channel.port1.onmessage = ({ data }) => { clearTimeout(timeout); resolve(data); };
    worker.postMessage({ type }, [channel.port2]);
  });
}

function showUpdateAvailable(registration = swRegistration) {
  if (!registration?.waiting) return;
  elements.updateBanner.hidden = false;
  elements.pwaSummary.textContent = t('pwa.summaryUpdate');
}

async function updatePwaUI() {
  const supported = 'serviceWorker' in navigator && location.protocol !== 'file:';
  const installed = isStandalone();
  elements.pwaConnection.textContent = t(navigator.onLine ? 'pwa.online' : 'pwa.offline');
  elements.pwaInstallState.textContent = t(installed ? 'pwa.installed' : 'pwa.browser');
  elements.pwaInstallButton.disabled = installed;
  elements.pwaInstallButtons.forEach((button) => {
    button.hidden = installed;
    button.disabled = false;
    button.classList.toggle('install-ready', Boolean(deferredInstallPrompt));
  });
  elements.pwaCache.textContent = t(supported && (navigator.serviceWorker.controller || swRegistration?.active) ? 'pwa.ready' : 'pwa.unavailable');
  const worker = swRegistration?.waiting || swRegistration?.active || navigator.serviceWorker?.controller;
  const version = supported ? await messageServiceWorker(worker, 'GET_VERSION') : null;
  elements.pwaVersion.textContent = version?.version || 'v17';
  elements.pwaSummary.textContent = swRegistration?.waiting ? t('pwa.summaryUpdate') : t('pwa.summaryReady');
}

async function installPwa() {
  if (isStandalone()) return;
  if (!deferredInstallPrompt) { showToast(t('pwa.installUnavailable')); return; }
  elements.pwaInstallButtons.forEach((button) => { button.disabled = true; });
  try {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  } catch {
    showToast(t('pwa.installUnavailable'));
  } finally {
    await updatePwaUI();
  }
}

async function checkForPwaUpdate() {
  if (!swRegistration) { showToast(t('pwa.offline')); return; }
  elements.pwaCheckButton.disabled = true;
  try {
    await swRegistration.update();
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (swRegistration.waiting) showUpdateAvailable();
    else showToast(t('pwa.noUpdate'));
  } catch { showToast(t('pwa.offline')); }
  elements.pwaCheckButton.disabled = false;
  await updatePwaUI();
}

async function repairOfflineData() {
  elements.pwaRepairButton.disabled = true;
  const worker = navigator.serviceWorker?.controller || swRegistration?.active;
  const result = await messageServiceWorker(worker, 'REFRESH_CACHE');
  showToast(t(result?.ok ? 'pwa.repaired' : 'pwa.repairFailed'));
  elements.pwaRepairButton.disabled = false;
  await updatePwaUI();
}

function activatePwaUpdate() {
  if (!swRegistration?.waiting) return;
  updateRequested = true;
  void messageServiceWorker(swRegistration.waiting, 'SKIP_WAITING');
}

function moveSelection(deltaRow, deltaCol) {
  const current = state.selected < 0 ? 0 : state.selected;
  const size = state.size || 9;
  const row = (Math.floor(current / size) + deltaRow + size) % size;
  const col = ((current % size) + deltaCol + size) % size;
  selectCell(row * size + col);
}

function bindEvents() {
  elements.homeButton.addEventListener('click', openMainMenu);
  elements.gameMenuButton.addEventListener('click', openMainMenu);
  elements.menuContinueButton.addEventListener('click', continueFromMainMenu);
  elements.mainMenu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-menu-mode]');
    if (!button) return;
    if (button.dataset.menuMode === 'daily') startDailyGame(); else startModeGame(button.dataset.menuMode);
  });
  elements.menuAcademyButton.addEventListener('click', openAcademy);
  elements.menuStatsButton.addEventListener('click', () => { updateStatsUI(); elements.statsDialog.showModal(); });
  elements.menuSettingsButton.addEventListener('click', () => { elements.settingsLanguage.value = prefs.language; void updatePwaUI(); elements.settingsDialog.showModal(); });
  elements.pauseButton.addEventListener('click', () => setPaused(!state.paused));
  elements.resumeButton.addEventListener('click', () => setPaused(false));
  elements.notesButton.addEventListener('click', toggleNotes);
  elements.autoNotesButton.addEventListener('click', toggleSmartNotes);
  elements.eraseButton.addEventListener('click', erase);
  elements.undoButton.addEventListener('click', undo);
  elements.hintButton.addEventListener('click', useHint);
  elements.hintCoachClose.addEventListener('click', dismissHint);
  elements.dailyButton.addEventListener('click', startDailyGame);
  elements.shareResultButton.addEventListener('click', shareResult);
  elements.replayButton.addEventListener('click', openReplay);
  elements.replayClose.addEventListener('click', () => { clearInterval(replayTimer); replayTimer = null; setReplayPlaying(false); elements.replayDialog.close(); });
  elements.replayPlay.addEventListener('click', toggleReplay);
  elements.replayRange.addEventListener('input', (event) => { clearInterval(replayTimer); replayTimer = null; setReplayPlaying(false); renderReplayFrame(Number(event.target.value)); });
  elements.settingsButton.addEventListener('click', () => { elements.settingsLanguage.value = prefs.language; void updatePwaUI(); elements.settingsDialog.showModal(); });
  elements.settingsClose.addEventListener('click', () => elements.settingsDialog.close());
  elements.settingsDone.addEventListener('click', () => elements.settingsDialog.close());
  elements.settingsLanguage.addEventListener('change', (event) => setLanguage(event.target.value));
  elements.introLanguage.addEventListener('change', (event) => setLanguage(event.target.value, false));
  elements.languageChoiceGrid.addEventListener('keydown', (event) => {
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const currentIndex = Math.max(0, LOCALES.findIndex(({ code }) => code === prefs.language));
    const direction = ['ArrowUp','ArrowLeft'].includes(event.key) ? -1 : 1;
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? LOCALES.length - 1 : (currentIndex + direction + LOCALES.length) % LOCALES.length;
    setLanguage(LOCALES[nextIndex].code, false);
    elements.languageChoiceGrid.querySelector(`[data-language="${LOCALES[nextIndex].code}"]`)?.focus();
    event.preventDefault();
  });
  elements.languageContinue.addEventListener('click', confirmLanguageChoice);
  elements.hapticsToggle.addEventListener('change', (event) => { prefs.haptics = event.target.checked; savePrefs(); haptic(30); });
  elements.autoPauseToggle.addEventListener('change', (event) => { prefs.autoPause = event.target.checked; savePrefs(); });
  elements.replayIntroButton.addEventListener('click', showIntro);
  elements.academyButton.addEventListener('click', openAcademy);
  elements.academySettingsButton.addEventListener('click', openAcademy);
  elements.academyClose.addEventListener('click', () => elements.academyDialog.close());
  elements.academyDialog.addEventListener('close', () => {
    if (pendingAcademyEvents.length) queueProgressEvents(pendingAcademyEvents.splice(0));
  });
  elements.academyLessonList.addEventListener('click', (event) => {
    if (event.target.closest('[data-academy-rules]')) { renderAcademyRules(); return; }
    const button = event.target.closest('[data-lesson]');
    if (button) renderAcademyLesson(button.dataset.lesson);
  });
  elements.academyChoices.addEventListener('click', answerAcademyQuestion);
  elements.academyRulesStart.addEventListener('click', beginAcademyLessons);
  elements.academyNextButton.addEventListener('click', nextAcademyLesson);
  elements.backupExportButton.addEventListener('click', exportBackup);
  elements.backupRestoreButton.addEventListener('click', () => elements.backupFileInput.click());
  elements.backupFileInput.addEventListener('change', (event) => { const [file] = event.target.files; event.target.value = ''; void restoreBackup(file); });
  elements.pwaInstallButton.addEventListener('click', installPwa);
  elements.pwaInstallButtons.forEach((button) => button.addEventListener('click', installPwa));
  elements.pwaCheckButton.addEventListener('click', checkForPwaUpdate);
  elements.pwaRepairButton.addEventListener('click', repairOfflineData);
  elements.updateAction.addEventListener('click', activatePwaUpdate);
  elements.updateDismiss.addEventListener('click', () => { elements.updateBanner.hidden = true; });
  elements.introStart.addEventListener('click', finishIntro);
  elements.newGameButton.addEventListener('click', () => startModeGame(state.mode === 'daily' ? 'classic' : state.mode));
  elements.dialogAction.addEventListener('click', () => startModeGame(state.mode === 'daily' ? 'classic' : state.mode));
  elements.dialogClose.addEventListener('click', () => elements.dialog.close());
  elements.difficultyButton.addEventListener('click', () => {
    const open = elements.difficultyMenu.classList.toggle('open');
    elements.difficultyButton.setAttribute('aria-expanded', open);
  });
  elements.difficultyMenu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-difficulty]');
    if (!button) return;
    elements.difficultyMenu.classList.remove('open');
    elements.difficultyButton.setAttribute('aria-expanded', 'false');
    const mode = state.mode === 'daily' ? 'classic' : state.mode;
    const variant = mode === 'hyper' ? 'hyper' : mode === 'mini' ? 'mini' : 'classic';
    startNewGame(button.dataset.difficulty, { mode, variant });
  });
  elements.modeButton.addEventListener('click', (event) => { event.stopPropagation(); elements.modeMenu.classList.toggle('open'); });
  elements.modeMenu.addEventListener('click', (event) => { const button = event.target.closest('[data-mode]'); if (!button) return; elements.modeMenu.classList.remove('open'); startModeGame(button.dataset.mode); });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.difficulty-wrap')) { elements.difficultyMenu.classList.remove('open'); elements.difficultyButton.setAttribute('aria-expanded', 'false'); }
    if (!event.target.closest('#modeMenu') && !event.target.closest('#modeButton')) elements.modeMenu.classList.remove('open');
  });
  elements.themeButton.addEventListener('click', () => { prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark'; savePrefs(); applyPrefs(); tone(500, .05); });
  elements.soundButton.addEventListener('click', () => { prefs.sound = !prefs.sound; savePrefs(); applyPrefs(); tone(500, .05); });
  elements.statsButton.addEventListener('click', () => { updateStatsUI(); elements.statsDialog.showModal(); });
  elements.statsClose.addEventListener('click', () => elements.statsDialog.close());
  elements.statsPlay.addEventListener('click', () => elements.statsDialog.close());

  document.addEventListener('keydown', (event) => {
    if (!elements.mainMenu.hidden) {
      if (event.key === 'Escape') { closeMainMenu(true); event.preventDefault(); }
      return;
    }
    if (elements.dialog.open || elements.statsDialog.open || elements.settingsDialog.open || elements.replayDialog.open || elements.academyDialog.open || !elements.introScreen.hidden) return;
    if (/^[1-9]$/.test(event.key) && Number(event.key) <= state.size) enterNumber(Number(event.key));
    else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') erase();
    else if (event.key.toLowerCase() === 'n') toggleNotes();
    else if (event.key.toLowerCase() === 'a') toggleSmartNotes();
    else if (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey)) undo();
    else if (event.key === 'ArrowUp') moveSelection(-1, 0);
    else if (event.key === 'ArrowDown') moveSelection(1, 0);
    else if (event.key === 'ArrowLeft') moveSelection(0, -1);
    else if (event.key === 'ArrowRight') moveSelection(0, 1);
    else if (event.key === ' ') setPaused(!state.paused);
    else return;
    event.preventDefault();
  });

  document.addEventListener('visibilitychange', () => { if (prefs.autoPause && document.hidden && state.status === 'playing' && !state.paused) setPaused(true); });
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (!state.paused && state.status === 'playing' && state.mode !== 'zen') {
      state.seconds += 1;
      elements.timer.textContent = formatTime(state.seconds);
      if (state.seconds % 5 === 0) save();
    }
  }, 1000);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') { await updatePwaUI(); return; }
  try {
    swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    const trackInstallingWorker = () => {
      const installing = swRegistration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) showUpdateAvailable();
        void updatePwaUI();
      });
    };
    if (swRegistration.waiting) showUpdateAvailable();
    swRegistration.addEventListener('updatefound', trackInstallingWorker);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updateRequested) location.reload();
      else void updatePwaUI();
    });
    await navigator.serviceWorker.ready;
    await updatePwaUI();
  } catch { showToast(t('toast.offlineLater')); await updatePwaUI(); }
}

function init() {
  applyPrefs(); initializeMiniBoard();
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; void updatePwaUI(); });
  window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; void updatePwaUI(); });
  window.addEventListener('online', () => void updatePwaUI());
  window.addEventListener('offline', () => void updatePwaUI());
  const saved = readJSON(STORAGE_KEY, null);
  const launchMode = new URLSearchParams(location.search).get('mode');
  const shortcutMode = ['daily','killer','hyper','mini','zen'].includes(launchMode) ? launchMode : null;
  if (shortcutMode) {
    if (shortcutMode === 'daily') {
      const daily = dailyConfig(); state = freshState(daily.difficulty, { mode:'daily', seed:daily.seed, dailyDate:daily.date });
    } else {
      const variant = shortcutMode === 'hyper' ? 'hyper' : shortcutMode === 'mini' ? 'mini' : 'classic';
      state = freshState('medium', { mode:shortcutMode, variant });
    }
    stats.played += 1; saveStats(); save();
    history.replaceState({}, '', location.pathname);
  } else if (validSavedGame(saved)) {
    state = saved;
    state.notes = state.notes.map((note) => Array.isArray(note) ? note : []);
    state.history = Array.isArray(state.history) ? state.history : [];
    state.mode ||= 'classic';
    state.variant ||= state.mode === 'hyper' ? 'hyper' : state.mode === 'mini' ? 'mini' : 'classic';
    const config = getVariantConfig(state.variant);
    state.size ||= config.size; state.boxRows ||= config.boxRows; state.boxCols ||= config.boxCols;
    state.cages = Array.isArray(state.cages) ? state.cages : state.mode === 'killer' ? createKillerCages(state.solution) : [];
    state.replay = Array.isArray(state.replay) ? state.replay : [];
    state.seenTechniqueSignatures = Array.isArray(state.seenTechniqueSignatures) ? state.seenTechniqueSignatures : [];
    state.hintsUsed ||= 0;
    state.autoNotesUsed ||= false;
    state.smartNotesActive ||= false;
    state.manualNotesUsed ||= false;
    state.lastHint ||= null;
    if (state.lastHint && !state.lastHint.technique) state.lastHint.technique = 'reveal';
    state.paused = false;
    showToast(t('toast.restored'));
  } else {
    state = freshState('medium');
    stats.played += 1; saveStats(); save();
  }
  initializeBoard(state.size); bindEvents();
  render(); updateStatsUI(); startTimer(); registerServiceWorker();
  if (!prefs.onboarded) showIntro();
  else if (!shortcutMode) openMainMenu();
}

init();
