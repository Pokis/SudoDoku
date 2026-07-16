import test from 'node:test';
import assert from 'node:assert/strict';
import { countSolutions, createSeededRandom, generatePuzzle, generateSolvedBoard, isComplete, isValidPlacement, solve } from '../src/sudoku.js';
import { findTechniqueHint } from '../src/techniques.js';

test('generates valid solved boards', () => {
  const board = generateSolvedBoard();
  assert.equal(board.length, 81);
  assert.ok(board.every((value, index) => isValidPlacement(board, index, value)));
});

test('generated puzzles have exactly one solution', () => {
  for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
    const { puzzle, solution } = generatePuzzle(difficulty);
    assert.equal(countSolutions([...puzzle]), 1, `${difficulty} should be unique`);
    const solved = [...puzzle];
    assert.equal(solve(solved), true);
    assert.deepEqual(solved, solution);
    assert.equal(isComplete(solved, solution), true);
  }
});

test('invalid placements are rejected', () => {
  const board = Array(81).fill(0);
  board[0] = 5;
  assert.equal(isValidPlacement(board, 1, 5), false);
  assert.equal(isValidPlacement(board, 9, 5), false);
  assert.equal(isValidPlacement(board, 10, 5), false);
  assert.equal(isValidPlacement(board, 40, 5), true);
});

test('seeded daily puzzles are reproducible', () => {
  const first = generatePuzzle('hard', createSeededRandom('2026-07-15'));
  const second = generatePuzzle('hard', createSeededRandom('2026-07-15'));
  assert.deepEqual(first.puzzle, second.puzzle);
  assert.deepEqual(first.solution, second.solution);
});

test('Mini and Hyper variants generate unique valid puzzles', () => {
  for (const variant of ['mini', 'hyper']) {
    const { puzzle, solution } = generatePuzzle('medium', createSeededRandom(`test-${variant}`), variant);
    assert.equal(puzzle.length, variant === 'mini' ? 36 : 81);
    assert.equal(countSolutions([...puzzle], 2, variant), 1);
    assert.ok(solution.every((value, index) => isValidPlacement(solution, index, value, variant)));
  }
});

test('technique hints identify a forced naked single', () => {
  const solution = generateSolvedBoard(createSeededRandom('technique-test'));
  const board = [...solution];
  board[0] = 0;
  const hint = findTechniqueHint(board, solution);
  assert.equal(hint.technique, 'nakedSingle');
  assert.equal(hint.index, 0);
  assert.equal(hint.value, solution[0]);
});

const grid = (text) => [...text].map((value) => value === '.' ? 0 : Number(value));
const techniqueSolution = grid('643752918195638274287419356372564891964821537518397462726943185831275649459186723');

test('technique hints explain naked-pair eliminations', () => {
  const board = grid('...7.........3.27..............6...1.6...153..........7.........3.2..649.5.......');
  const hint = findTechniqueHint(board, techniqueSolution);
  assert.equal(hint.technique, 'nakedPair');
  assert.deepEqual(hint.pair, [1, 8]);
  assert.ok(hint.eliminations.length >= 1);
});

test('technique hints identify an X-Wing and its eliminations', () => {
  const board = grid('64...2..8...6......8......6.......9............8.9.........3.85...........9..6.2.');
  const hint = findTechniqueHint(board, techniqueSolution, 'classic', 'xWing');
  assert.equal(hint.technique, 'xWing');
  assert.equal(hint.value, 9);
  assert.equal(hint.cells.length, 4);
  assert.ok(hint.eliminations.length >= 1);
});

test('advanced hint engine detects triples, wings, towers, and fish', () => {
  const positions = {
    nakedTriple:'...7.2...1.5.....42.741.3...7256..9..6....5.7...3..46.7.......5.31..56.94.9.8.7.3',
    hiddenTriple:'.4.75.9.8195....7..8.4...563.2.6.8...6.82.5....83..4627.6...1..831....49......7.3',
    xyWing:'6.....9.8.9....27.2.........7.....91.6.8...375.8....6..2.9..1..8......4..59...7.3',
    skyscraper:'.4...2.18...638..4287.......7.......96.8.1....1.397..2.2.9..18....2..6.......67..',
    swordfish:'64.........5.3...4.....93..37....89..6.....37..8...4..7..9.3.8.......64...9.8....',
  };
  for (const [technique, text] of Object.entries(positions)) {
    const hint = findTechniqueHint(grid(text), techniqueSolution, 'classic', technique);
    assert.equal(hint.technique, technique);
    assert.ok(hint.cells.length >= 3);
    assert.ok(hint.eliminations.length >= 1);
  }
});
