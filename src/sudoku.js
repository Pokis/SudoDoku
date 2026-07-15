export const SIZE = 9;

export const DIFFICULTIES = {
  easy: { label: 'Easy', clues: 44 },
  medium: { label: 'Medium', clues: 36 },
  hard: { label: 'Hard', clues: 30 },
  expert: { label: 'Expert', clues: 26 },
};

const MINI_CLUES = { easy: 24, medium: 20, hard: 17, expert: 15 };

export function getVariantConfig(variant = 'classic') {
  return variant === 'mini'
    ? { size: 6, boxRows: 2, boxCols: 3, variant }
    : { size: 9, boxRows: 3, boxCols: 3, variant };
}

export function createSeededRandom(seedText) {
  let seed = 2166136261;
  for (const character of String(seedText)) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export const shuffled = (items, random = Math.random) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const HYPER_STARTS = [[1, 1], [1, 5], [5, 1], [5, 5]];
const UNIT_CACHE = new Map();
const CELL_UNIT_CACHE = new Map();

export function getHyperRegion(index, size = 9) {
  if (size !== 9) return -1;
  const row = Math.floor(index / size);
  const col = index % size;
  return HYPER_STARTS.findIndex(([startRow, startCol]) =>
    row >= startRow && row < startRow + 3 && col >= startCol && col < startCol + 3);
}

export function getUnits(variant = 'classic') {
  if (UNIT_CACHE.has(variant)) return UNIT_CACHE.get(variant);
  const { size, boxRows, boxCols } = getVariantConfig(variant);
  const units = [];
  for (let row = 0; row < size; row += 1) units.push({ type: 'row', number: row + 1, cells: Array.from({ length: size }, (_, col) => row * size + col) });
  for (let col = 0; col < size; col += 1) units.push({ type: 'column', number: col + 1, cells: Array.from({ length: size }, (_, row) => row * size + col) });
  let boxNumber = 1;
  for (let startRow = 0; startRow < size; startRow += boxRows) {
    for (let startCol = 0; startCol < size; startCol += boxCols) {
      const cells = [];
      for (let row = 0; row < boxRows; row += 1) for (let col = 0; col < boxCols; col += 1) cells.push((startRow + row) * size + startCol + col);
      units.push({ type: 'box', number: boxNumber, cells }); boxNumber += 1;
    }
  }
  if (variant === 'hyper') {
    HYPER_STARTS.forEach(([startRow, startCol], index) => {
      const cells = [];
      for (let row = 0; row < 3; row += 1) for (let col = 0; col < 3; col += 1) cells.push((startRow + row) * 9 + startCol + col);
      units.push({ type: 'hyper', number: index + 1, cells });
    });
  }
  UNIT_CACHE.set(variant, units);
  return units;
}

function getCellUnits(index, variant) {
  const key = `${variant}:${index}`;
  if (!CELL_UNIT_CACHE.has(key)) CELL_UNIT_CACHE.set(key, getUnits(variant).filter((unit) => unit.cells.includes(index)));
  return CELL_UNIT_CACHE.get(key);
}

export function isValidPlacement(board, index, value, variant = 'classic') {
  if (!value) return true;
  return getCellUnits(index, variant)
    .every((unit) => unit.cells.every((peer) => peer === index || board[peer] !== value));
}

export function getCandidates(board, index, variant = 'classic') {
  if (board[index]) return [];
  const { size } = getVariantConfig(variant);
  const result = [];
  for (let value = 1; value <= size; value += 1) if (isValidPlacement(board, index, value, variant)) result.push(value);
  return result;
}

function nextEmpty(board, variant) {
  let bestIndex = -1;
  let bestCandidates = null;
  for (let index = 0; index < board.length; index += 1) {
    if (board[index] !== 0) continue;
    const options = getCandidates(board, index, variant);
    if (!options.length) return { index, options };
    if (!bestCandidates || options.length < bestCandidates.length) {
      bestIndex = index; bestCandidates = options;
      if (options.length === 1) break;
    }
  }
  return { index: bestIndex, options: bestCandidates || [] };
}

export function solve(board, randomize = false, random = Math.random, variant = 'classic') {
  const { index, options } = nextEmpty(board, variant);
  if (index === -1) return true;
  for (const value of randomize ? shuffled(options, random) : options) {
    board[index] = value;
    if (solve(board, randomize, random, variant)) return true;
    board[index] = 0;
  }
  return false;
}

export function countSolutions(board, limit = 2, variant = 'classic') {
  let count = 0;
  const search = () => {
    if (count >= limit) return;
    const { index, options } = nextEmpty(board, variant);
    if (index === -1) { count += 1; return; }
    for (const value of options) {
      board[index] = value; search(); board[index] = 0;
      if (count >= limit) return;
    }
  };
  search(); return count;
}

export function generateSolvedBoard(random = Math.random, variant = 'classic') {
  const { size } = getVariantConfig(variant);
  const board = Array(size * size).fill(0);
  solve(board, true, random, variant);
  return board;
}

export function generatePuzzle(difficulty = 'medium', random = Math.random, variant = 'classic') {
  const { size } = getVariantConfig(variant);
  const targetClues = variant === 'mini' ? MINI_CLUES[difficulty] : (DIFFICULTIES[difficulty] || DIFFICULTIES.medium).clues;
  const total = size * size;
  let best = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const solution = generateSolvedBoard(random, variant);
    const puzzle = [...solution];
    const pairCount = Math.ceil(total / 2);
    const pairs = shuffled(Array.from({ length: pairCount }, (_, index) => [index, total - 1 - index]), random);
    let clueCount = total;

    for (const [first, second] of pairs) {
      const removalCount = first === second ? 1 : 2;
      if (clueCount - removalCount < targetClues) continue;
      const oldFirst = puzzle[first]; const oldSecond = puzzle[second];
      puzzle[first] = 0; puzzle[second] = 0;
      if (countSolutions([...puzzle], 2, variant) !== 1) {
        puzzle[first] = oldFirst; puzzle[second] = oldSecond;
      } else clueCount -= removalCount;
      if (clueCount <= targetClues) break;
    }

    const candidate = { puzzle, solution, difficulty, variant, size };
    if (!best || clueCount < best.puzzle.filter(Boolean).length) best = candidate;
    if (clueCount <= targetClues + 1) break;
  }
  return best;
}

export function getPeers(index, variant = 'classic') {
  const peers = new Set();
  getCellUnits(index, variant).forEach((unit) => unit.cells.forEach((peer) => peers.add(peer)));
  peers.delete(index); return peers;
}

export function isComplete(board, solution) {
  return board.length === solution.length && board.every((value, index) => value === solution[index]);
}
