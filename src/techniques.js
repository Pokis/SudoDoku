import { getCandidates, getUnits, getVariantConfig } from './sudoku.js';

const samePair = (first, second) => first.length === 2 && second.length === 2 && first[0] === second[0] && first[1] === second[1];

export function buildCandidateMap(board, variant = 'classic') {
  return board.map((value, index) => value ? [] : getCandidates(board, index, variant));
}

export function findTechniqueHint(board, solution, variant = 'classic') {
  const { size } = getVariantConfig(variant);
  const candidateMap = buildCandidateMap(board, variant);

  for (let index = 0; index < board.length; index += 1) {
    if (!board[index] && candidateMap[index].length === 1) {
      return { technique: 'nakedSingle', index, value: candidateMap[index][0], cells: [index], eliminations: [] };
    }
  }

  for (const unit of getUnits(variant)) {
    for (let value = 1; value <= size; value += 1) {
      const spots = unit.cells.filter((index) => !board[index] && candidateMap[index].includes(value));
      if (spots.length === 1) {
        return { technique: 'hiddenSingle', index: spots[0], value, cells: [spots[0]], eliminations: [], unitType: unit.type, unitNumber: unit.number };
      }
    }
  }

  for (const unit of getUnits(variant)) {
    const pairCells = unit.cells.filter((index) => !board[index] && candidateMap[index].length === 2);
    for (let first = 0; first < pairCells.length; first += 1) {
      for (let second = first + 1; second < pairCells.length; second += 1) {
        const firstIndex = pairCells[first]; const secondIndex = pairCells[second];
        if (!samePair(candidateMap[firstIndex], candidateMap[secondIndex])) continue;
        const pair = candidateMap[firstIndex];
        const eliminations = unit.cells
          .filter((index) => index !== firstIndex && index !== secondIndex && !board[index])
          .flatMap((index) => pair.filter((value) => candidateMap[index].includes(value)).map((value) => ({ index, value })));
        if (eliminations.length) return { technique: 'nakedPair', cells: [firstIndex, secondIndex], pair, eliminations, unitType: unit.type, unitNumber: unit.number };
      }
    }
  }

  if (size === 9) {
    for (let value = 1; value <= 9; value += 1) {
      const rowPatterns = [];
      for (let row = 0; row < 9; row += 1) {
        const columns = [];
        for (let col = 0; col < 9; col += 1) if (!board[row * 9 + col] && candidateMap[row * 9 + col].includes(value)) columns.push(col);
        if (columns.length === 2) rowPatterns.push({ row, positions: columns });
      }
      for (let first = 0; first < rowPatterns.length; first += 1) {
        for (let second = first + 1; second < rowPatterns.length; second += 1) {
          const a = rowPatterns[first]; const b = rowPatterns[second];
          if (a.positions[0] !== b.positions[0] || a.positions[1] !== b.positions[1]) continue;
          const cells = [a.row * 9 + a.positions[0], a.row * 9 + a.positions[1], b.row * 9 + b.positions[0], b.row * 9 + b.positions[1]];
          const eliminations = [];
          for (let row = 0; row < 9; row += 1) if (row !== a.row && row !== b.row) {
            a.positions.forEach((col) => { const index = row * 9 + col; if (!board[index] && candidateMap[index].includes(value)) eliminations.push({ index, value }); });
          }
          if (eliminations.length) return { technique: 'xWing', orientation: 'rows', value, cells, eliminations, lines: [a.row + 1, b.row + 1], positions: a.positions.map((col) => col + 1) };
        }
      }

      const columnPatterns = [];
      for (let col = 0; col < 9; col += 1) {
        const rows = [];
        for (let row = 0; row < 9; row += 1) if (!board[row * 9 + col] && candidateMap[row * 9 + col].includes(value)) rows.push(row);
        if (rows.length === 2) columnPatterns.push({ col, positions: rows });
      }
      for (let first = 0; first < columnPatterns.length; first += 1) {
        for (let second = first + 1; second < columnPatterns.length; second += 1) {
          const a = columnPatterns[first]; const b = columnPatterns[second];
          if (a.positions[0] !== b.positions[0] || a.positions[1] !== b.positions[1]) continue;
          const cells = [a.positions[0] * 9 + a.col, a.positions[1] * 9 + a.col, b.positions[0] * 9 + b.col, b.positions[1] * 9 + b.col];
          const eliminations = [];
          for (let col = 0; col < 9; col += 1) if (col !== a.col && col !== b.col) {
            a.positions.forEach((row) => { const index = row * 9 + col; if (!board[index] && candidateMap[index].includes(value)) eliminations.push({ index, value }); });
          }
          if (eliminations.length) return { technique: 'xWing', orientation: 'columns', value, cells, eliminations, lines: [a.col + 1, b.col + 1], positions: a.positions.map((row) => row + 1) };
        }
      }
    }
  }

  const index = board.findIndex((value, position) => value !== solution[position]);
  return index >= 0 ? { technique: 'reveal', index, value: solution[index], cells: [index], eliminations: [] } : null;
}
