import { getCandidates, getPeers, getUnits, getVariantConfig } from './sudoku.js';

const samePair = (first, second) => first.length === 2 && second.length === 2 && first[0] === second[0] && first[1] === second[1];

const combinations = (items, count) => {
  const result = [];
  const visit = (start, chosen) => {
    if (chosen.length === count) { result.push(chosen); return; }
    for (let index = start; index <= items.length - (count - chosen.length); index += 1) visit(index + 1, [...chosen, items[index]]);
  };
  visit(0, []);
  return result;
};

export function buildCandidateMap(board, variant = 'classic') {
  return board.map((value, index) => value ? [] : getCandidates(board, index, variant));
}

export function findTechniqueHint(board, solution, variant = 'classic', preferredTechnique = null) {
  const { size } = getVariantConfig(variant);
  const units = getUnits(variant);
  const candidateMap = buildCandidateMap(board, variant);

  for (let index = 0; index < board.length; index += 1) {
    if (!board[index] && candidateMap[index].length === 1) {
      if (!preferredTechnique || preferredTechnique === 'nakedSingle') return { technique:'nakedSingle', index, value:candidateMap[index][0], cells:[index], eliminations:[] };
    }
  }

  for (const unit of units) {
    for (let value = 1; value <= size; value += 1) {
      const spots = unit.cells.filter((index) => !board[index] && candidateMap[index].includes(value));
      if (spots.length === 1) {
        if (!preferredTechnique || preferredTechnique === 'hiddenSingle') return { technique:'hiddenSingle', index:spots[0], value, cells:[spots[0]], eliminations:[], unitType:unit.type, unitNumber:unit.number };
      }
    }
  }

  for (const unit of units) {
    const pairCells = unit.cells.filter((index) => !board[index] && candidateMap[index].length === 2);
    for (let first = 0; first < pairCells.length; first += 1) {
      for (let second = first + 1; second < pairCells.length; second += 1) {
        const firstIndex = pairCells[first]; const secondIndex = pairCells[second];
        if (!samePair(candidateMap[firstIndex], candidateMap[secondIndex])) continue;
        const pair = candidateMap[firstIndex];
        const eliminations = unit.cells
          .filter((index) => index !== firstIndex && index !== secondIndex && !board[index])
          .flatMap((index) => pair.filter((value) => candidateMap[index].includes(value)).map((value) => ({ index, value })));
        if (eliminations.length && (!preferredTechnique || preferredTechnique === 'nakedPair')) return { technique:'nakedPair', cells:[firstIndex, secondIndex], pair, eliminations, unitType:unit.type, unitNumber:unit.number };
      }
    }
  }

  const boxes = units.filter(({ type }) => type === 'box');
  for (const box of boxes) {
    for (let value = 1; value <= size; value += 1) {
      const spots = box.cells.filter((index) => !board[index] && candidateMap[index].includes(value));
      if (spots.length < 2) continue;
      const rows = new Set(spots.map((index) => Math.floor(index / size)));
      const columns = new Set(spots.map((index) => index % size));
      const lineType = rows.size === 1 ? 'row' : columns.size === 1 ? 'column' : null;
      if (!lineType) continue;
      const line = lineType === 'row' ? [...rows][0] : [...columns][0];
      const eliminations = [];
      for (let position = 0; position < size; position += 1) {
        const index = lineType === 'row' ? line * size + position : position * size + line;
        if (!box.cells.includes(index) && !board[index] && candidateMap[index].includes(value)) eliminations.push({ index, value });
      }
      if (eliminations.length && (!preferredTechnique || preferredTechnique === 'pointingPair')) return { technique:'pointingPair', cells:spots, value, eliminations, unitType:'box', unitNumber:box.number, lineType, lineNumber:line + 1 };
    }
  }

  for (const line of units.filter(({ type }) => type === 'row' || type === 'column')) {
    for (let value = 1; value <= size; value += 1) {
      const spots = line.cells.filter((index) => !board[index] && candidateMap[index].includes(value));
      if (spots.length < 2) continue;
      const box = boxes.find(({ cells }) => spots.every((index) => cells.includes(index)));
      if (!box) continue;
      const eliminations = box.cells
        .filter((index) => !line.cells.includes(index) && !board[index] && candidateMap[index].includes(value))
        .map((index) => ({ index, value }));
      if (eliminations.length && (!preferredTechnique || preferredTechnique === 'boxLineReduction')) return { technique:'boxLineReduction', cells:spots, value, eliminations, unitType:line.type, unitNumber:line.number, boxNumber:box.number };
    }
  }

  for (const unit of units) {
    const positions = new Map();
    for (let value = 1; value <= size; value += 1) {
      const spots = unit.cells.filter((index) => !board[index] && candidateMap[index].includes(value));
      if (spots.length === 2) positions.set(value, spots);
    }
    for (const [firstValue, secondValue] of combinations([...positions.keys()], 2)) {
      const firstCells = positions.get(firstValue); const secondCells = positions.get(secondValue);
      if (firstCells[0] !== secondCells[0] || firstCells[1] !== secondCells[1]) continue;
      const pair = [firstValue, secondValue];
      const eliminations = firstCells.flatMap((index) => candidateMap[index]
        .filter((value) => !pair.includes(value))
        .map((value) => ({ index, value })));
      if (eliminations.length && (!preferredTechnique || preferredTechnique === 'hiddenPair')) return { technique:'hiddenPair', cells:firstCells, pair, eliminations, unitType:unit.type, unitNumber:unit.number };
    }
  }

  for (const unit of units) {
    const eligible = unit.cells.filter((index) => !board[index] && candidateMap[index].length >= 2 && candidateMap[index].length <= 3);
    for (const tripleCells of combinations(eligible, 3)) {
      const values = [...new Set(tripleCells.flatMap((index) => candidateMap[index]))].sort((a, b) => a - b);
      if (values.length !== 3) continue;
      const eliminations = unit.cells
        .filter((index) => !tripleCells.includes(index) && !board[index])
        .flatMap((index) => values.filter((value) => candidateMap[index].includes(value)).map((value) => ({ index, value })));
      if (eliminations.length && (!preferredTechnique || preferredTechnique === 'nakedTriple')) return { technique:'nakedTriple', cells:tripleCells, values, eliminations, unitType:unit.type, unitNumber:unit.number };
    }
  }

  for (const unit of units) {
    const positions = new Map();
    for (let value = 1; value <= size; value += 1) {
      const spots = unit.cells.filter((index) => !board[index] && candidateMap[index].includes(value));
      if (spots.length >= 2 && spots.length <= 3) positions.set(value, spots);
    }
    for (const values of combinations([...positions.keys()], 3)) {
      const tripleCells = [...new Set(values.flatMap((value) => positions.get(value)))].sort((a, b) => a - b);
      if (tripleCells.length !== 3) continue;
      const eliminations = tripleCells.flatMap((index) => candidateMap[index]
        .filter((value) => !values.includes(value))
        .map((value) => ({ index, value })));
      if (eliminations.length && (!preferredTechnique || preferredTechnique === 'hiddenTriple')) return { technique:'hiddenTriple', cells:tripleCells, values, eliminations, unitType:unit.type, unitNumber:unit.number };
    }
  }

  if (size === 9) {
    for (let value = 1; value <= 9; value += 1) {
      const rowPatterns = [];
      for (let row = 0; row < 9; row += 1) {
        const columns = [];
        for (let col = 0; col < 9; col += 1) if (!board[row * 9 + col] && candidateMap[row * 9 + col].includes(value)) columns.push(col);
        if (columns.length === 2) rowPatterns.push({ row, positions:columns });
      }
      for (const [a, b] of combinations(rowPatterns, 2)) {
        if (a.positions[0] !== b.positions[0] || a.positions[1] !== b.positions[1]) continue;
        const cells = [a.row * 9 + a.positions[0], a.row * 9 + a.positions[1], b.row * 9 + b.positions[0], b.row * 9 + b.positions[1]];
        const eliminations = [];
        for (let row = 0; row < 9; row += 1) if (row !== a.row && row !== b.row) {
          a.positions.forEach((col) => { const index = row * 9 + col; if (!board[index] && candidateMap[index].includes(value)) eliminations.push({ index, value }); });
        }
        if (eliminations.length && (!preferredTechnique || preferredTechnique === 'xWing')) return { technique:'xWing', orientation:'rows', value, cells, eliminations, lines:[a.row + 1, b.row + 1], positions:a.positions.map((col) => col + 1) };
      }

      const columnPatterns = [];
      for (let col = 0; col < 9; col += 1) {
        const rows = [];
        for (let row = 0; row < 9; row += 1) if (!board[row * 9 + col] && candidateMap[row * 9 + col].includes(value)) rows.push(row);
        if (rows.length === 2) columnPatterns.push({ col, positions:rows });
      }
      for (const [a, b] of combinations(columnPatterns, 2)) {
        if (a.positions[0] !== b.positions[0] || a.positions[1] !== b.positions[1]) continue;
        const cells = [a.positions[0] * 9 + a.col, a.positions[1] * 9 + a.col, b.positions[0] * 9 + b.col, b.positions[1] * 9 + b.col];
        const eliminations = [];
        for (let col = 0; col < 9; col += 1) if (col !== a.col && col !== b.col) {
          a.positions.forEach((row) => { const index = row * 9 + col; if (!board[index] && candidateMap[index].includes(value)) eliminations.push({ index, value }); });
        }
        if (eliminations.length && (!preferredTechnique || preferredTechnique === 'xWing')) return { technique:'xWing', orientation:'columns', value, cells, eliminations, lines:[a.col + 1, b.col + 1], positions:a.positions.map((row) => row + 1) };
      }
    }

    const pairCells = candidateMap.map((candidates, index) => ({ index, candidates })).filter(({ candidates }) => candidates.length === 2);
    for (const pivot of pairCells) {
      const [x, y] = pivot.candidates;
      const pivotPeers = getPeers(pivot.index, variant);
      for (let z = 1; z <= 9; z += 1) {
        if (z === x || z === y) continue;
        const xWings = pairCells.filter(({ index, candidates }) => index !== pivot.index && pivotPeers.has(index) && candidates.includes(x) && candidates.includes(z));
        const yWings = pairCells.filter(({ index, candidates }) => index !== pivot.index && pivotPeers.has(index) && candidates.includes(y) && candidates.includes(z));
        for (const firstWing of xWings) {
          for (const secondWing of yWings) {
            if (firstWing.index === secondWing.index) continue;
            const firstPeers = getPeers(firstWing.index, variant);
            const secondPeers = getPeers(secondWing.index, variant);
            const patternCells = [pivot.index, firstWing.index, secondWing.index];
            const eliminations = candidateMap
              .map((candidates, index) => ({ candidates, index }))
              .filter(({ candidates, index }) => !patternCells.includes(index) && candidates.includes(z) && firstPeers.has(index) && secondPeers.has(index))
              .map(({ index }) => ({ index, value:z }));
            if (eliminations.length && (!preferredTechnique || preferredTechnique === 'xyWing')) return { technique:'xyWing', cells:patternCells, pivot:pivot.index, pincers:[firstWing.index, secondWing.index], values:[x, y, z], value:z, eliminations };
          }
        }
      }
    }

    for (let value = 1; value <= 9; value += 1) {
      for (const orientation of ['rows', 'columns']) {
        const strongLines = [];
        for (let line = 0; line < 9; line += 1) {
          const positions = [];
          for (let cross = 0; cross < 9; cross += 1) {
            const index = orientation === 'rows' ? line * 9 + cross : cross * 9 + line;
            if (!board[index] && candidateMap[index].includes(value)) positions.push(cross);
          }
          if (positions.length === 2) strongLines.push({ line, positions });
        }
        for (const [first, second] of combinations(strongLines, 2)) {
          const shared = first.positions.filter((position) => second.positions.includes(position));
          if (shared.length !== 1) continue;
          const firstRoofPosition = first.positions.find((position) => position !== shared[0]);
          const secondRoofPosition = second.positions.find((position) => position !== shared[0]);
          if (firstRoofPosition === secondRoofPosition) continue;
          const toIndex = (line, cross) => orientation === 'rows' ? line * 9 + cross : cross * 9 + line;
          const roofs = [toIndex(first.line, firstRoofPosition), toIndex(second.line, secondRoofPosition)];
          const cells = [toIndex(first.line, shared[0]), roofs[0], toIndex(second.line, shared[0]), roofs[1]];
          const firstRoofPeers = getPeers(roofs[0], variant);
          const secondRoofPeers = getPeers(roofs[1], variant);
          const eliminations = candidateMap
            .map((candidates, index) => ({ candidates, index }))
            .filter(({ candidates, index }) => !cells.includes(index) && candidates.includes(value) && firstRoofPeers.has(index) && secondRoofPeers.has(index))
            .map(({ index }) => ({ index, value }));
          if (eliminations.length && (!preferredTechnique || preferredTechnique === 'skyscraper')) return { technique:'skyscraper', orientation, value, cells, roofs, eliminations, lines:[first.line + 1, second.line + 1] };
        }
      }
    }

    for (let value = 1; value <= 9; value += 1) {
      for (const orientation of ['rows', 'columns']) {
        const patterns = [];
        for (let line = 0; line < 9; line += 1) {
          const positions = [];
          for (let cross = 0; cross < 9; cross += 1) {
            const index = orientation === 'rows' ? line * 9 + cross : cross * 9 + line;
            if (!board[index] && candidateMap[index].includes(value)) positions.push(cross);
          }
          if (positions.length >= 2 && positions.length <= 3) patterns.push({ line, positions });
        }
        for (const trio of combinations(patterns, 3)) {
          const crossingLines = [...new Set(trio.flatMap(({ positions }) => positions))].sort((a, b) => a - b);
          if (crossingLines.length !== 3) continue;
          const baseLines = trio.map(({ line }) => line);
          const cells = trio.flatMap(({ line, positions }) => positions.map((cross) => orientation === 'rows' ? line * 9 + cross : cross * 9 + line));
          const eliminations = [];
          for (let line = 0; line < 9; line += 1) if (!baseLines.includes(line)) {
            crossingLines.forEach((cross) => {
              const index = orientation === 'rows' ? line * 9 + cross : cross * 9 + line;
              if (!board[index] && candidateMap[index].includes(value)) eliminations.push({ index, value });
            });
          }
          if (eliminations.length && (!preferredTechnique || preferredTechnique === 'swordfish')) return { technique:'swordfish', orientation, value, cells, eliminations, lines:baseLines.map((line) => line + 1), positions:crossingLines.map((line) => line + 1) };
        }
      }
    }
  }

  if (preferredTechnique) return null;
  const index = board.findIndex((value, position) => value !== solution[position]);
  return index >= 0 ? { technique:'reveal', index, value:solution[index], cells:[index], eliminations:[] } : null;
}
