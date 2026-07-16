const LEVEL_L_BLOCKS = {
  1:[[1,26,19]], 2:[[1,44,34]], 3:[[1,70,55]], 4:[[1,100,80]], 5:[[1,134,108]],
  6:[[2,86,68]], 7:[[2,98,78]], 8:[[2,121,97]], 9:[[2,146,116]], 10:[[2,86,68],[2,87,69]],
};

const ALIGNMENT_CENTERS = {
  1:[], 2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30], 6:[6,34],
  7:[6,22,38], 8:[6,24,42], 9:[6,26,46], 10:[6,28,50],
};

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
let value = 1;
for (let index = 0; index < 255; index += 1) {
  GF_EXP[index] = value;
  GF_LOG[value] = index;
  value <<= 1;
  if (value & 0x100) value ^= 0x11d;
}
for (let index = 255; index < 512; index += 1) GF_EXP[index] = GF_EXP[index - 255];

const multiply = (first, second) => first && second ? GF_EXP[GF_LOG[first] + GF_LOG[second]] : 0;

function generatorPolynomial(degree) {
  let polynomial = [1];
  for (let index = 0; index < degree; index += 1) {
    const next = Array(polynomial.length + 1).fill(0);
    polynomial.forEach((coefficient, position) => {
      next[position] ^= coefficient;
      next[position + 1] ^= multiply(coefficient, GF_EXP[index]);
    });
    polynomial = next;
  }
  return polynomial;
}

function reedSolomon(data, degree) {
  const generator = generatorPolynomial(degree);
  const result = Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    generator.slice(1).forEach((coefficient, index) => { result[index] ^= multiply(coefficient, factor); });
  }
  return result;
}

class BitBuffer {
  constructor() { this.bits = []; }
  push(value, length) {
    for (let bit = length - 1; bit >= 0; bit -= 1) this.bits.push((value >>> bit) & 1);
  }
}

function capacityForVersion(version) {
  return LEVEL_L_BLOCKS[version].reduce((total, [count,, data]) => total + count * data, 0);
}

function chooseVersion(byteLength) {
  for (let version = 1; version <= 10; version += 1) {
    const countBits = version < 10 ? 8 : 16;
    if (4 + countBits + byteLength * 8 <= capacityForVersion(version) * 8) return version;
  }
  throw new Error('QR payload is too large');
}

function createCodewords(text, version) {
  const bytes = [...new TextEncoder().encode(text)];
  const capacity = capacityForVersion(version);
  const buffer = new BitBuffer();
  buffer.push(0b0100, 4);
  buffer.push(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((byte) => buffer.push(byte, 8));
  const remaining = capacity * 8 - buffer.bits.length;
  buffer.push(0, Math.min(4, remaining));
  while (buffer.bits.length % 8) buffer.bits.push(0);
  const data = [];
  for (let index = 0; index < buffer.bits.length; index += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1) byte = (byte << 1) | buffer.bits[index + bit];
    data.push(byte);
  }
  let pad = 0;
  while (data.length < capacity) {
    data.push(pad % 2 ? 0x11 : 0xec);
    pad += 1;
  }

  const blocks = [];
  let offset = 0;
  for (const [count, totalCount, dataCount] of LEVEL_L_BLOCKS[version]) {
    for (let block = 0; block < count; block += 1) {
      const blockData = data.slice(offset, offset + dataCount);
      blocks.push({ data:blockData, error:reedSolomon(blockData, totalCount - dataCount) });
      offset += dataCount;
    }
  }
  const interleaved = [];
  const maxData = Math.max(...blocks.map((block) => block.data.length));
  const maxError = Math.max(...blocks.map((block) => block.error.length));
  for (let index = 0; index < maxData; index += 1) blocks.forEach((block) => { if (index < block.data.length) interleaved.push(block.data[index]); });
  for (let index = 0; index < maxError; index += 1) blocks.forEach((block) => { if (index < block.error.length) interleaved.push(block.error[index]); });
  return interleaved;
}

const blankMatrix = (size) => ({
  values:Array.from({ length:size }, () => Array(size).fill(false)),
  reserved:Array.from({ length:size }, () => Array(size).fill(false)),
});

function setModule(matrix, row, column, dark, reserved = true) {
  if (row < 0 || column < 0 || row >= matrix.values.length || column >= matrix.values.length) return;
  matrix.values[row][column] = Boolean(dark);
  if (reserved) matrix.reserved[row][column] = true;
}

function placeFinder(matrix, top, left) {
  for (let row = -1; row <= 7; row += 1) {
    for (let column = -1; column <= 7; column += 1) {
      const inside = row >= 0 && row <= 6 && column >= 0 && column <= 6;
      const dark = inside && (row === 0 || row === 6 || column === 0 || column === 6 || (row >= 2 && row <= 4 && column >= 2 && column <= 4));
      setModule(matrix, top + row, left + column, dark);
    }
  }
}

function placeAlignment(matrix, centerRow, centerColumn) {
  if (matrix.reserved[centerRow][centerColumn]) return;
  for (let row = -2; row <= 2; row += 1) {
    for (let column = -2; column <= 2; column += 1) {
      const dark = Math.max(Math.abs(row), Math.abs(column)) !== 1;
      setModule(matrix, centerRow + row, centerColumn + column, dark);
    }
  }
}

function bchRemainder(value, polynomial, polynomialDegree) {
  let current = value;
  let degree = 31 - Math.clz32(current);
  while (degree >= polynomialDegree) {
    current ^= polynomial << (degree - polynomialDegree);
    degree = current ? 31 - Math.clz32(current) : -1;
  }
  return current;
}

function formatBits(mask) {
  const data = (1 << 3) | mask;
  return ((data << 10) | bchRemainder(data << 10, 0x537, 10)) ^ 0x5412;
}

function versionBits(version) {
  return (version << 12) | bchRemainder(version << 12, 0x1f25, 12);
}

function reserveFormatAreas(matrix) {
  const size = matrix.values.length;
  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) {
      setModule(matrix, index, 8, false);
      setModule(matrix, 8, index, false);
    }
  }
  for (let index = 0; index < 8; index += 1) {
    setModule(matrix, size - 1 - index, 8, false);
    setModule(matrix, 8, size - 1 - index, false);
  }
  setModule(matrix, size - 8, 8, true);
}

function placeFormat(matrix, mask) {
  const size = matrix.values.length;
  const bits = formatBits(mask);
  for (let index = 0; index < 15; index += 1) {
    const dark = Boolean((bits >> index) & 1);
    if (index < 6) setModule(matrix, index, 8, dark);
    else if (index < 8) setModule(matrix, index + 1, 8, dark);
    else setModule(matrix, size - 15 + index, 8, dark);

    if (index < 8) setModule(matrix, 8, size - index - 1, dark);
    else if (index < 9) setModule(matrix, 8, 15 - index, dark);
    else setModule(matrix, 8, 15 - index - 1, dark);
  }
  setModule(matrix, size - 8, 8, true);
}

function placeVersion(matrix, version) {
  if (version < 7) return;
  const size = matrix.values.length;
  const bits = versionBits(version);
  for (let index = 0; index < 18; index += 1) {
    const dark = Boolean((bits >> index) & 1);
    const row = Math.floor(index / 3);
    const column = index % 3 + size - 11;
    setModule(matrix, row, column, dark);
    setModule(matrix, column, row, dark);
  }
}

function buildBaseMatrix(version) {
  const size = version * 4 + 17;
  const matrix = blankMatrix(size);
  placeFinder(matrix, 0, 0);
  placeFinder(matrix, 0, size - 7);
  placeFinder(matrix, size - 7, 0);
  for (let index = 8; index < size - 8; index += 1) {
    setModule(matrix, 6, index, index % 2 === 0);
    setModule(matrix, index, 6, index % 2 === 0);
  }
  for (const row of ALIGNMENT_CENTERS[version]) for (const column of ALIGNMENT_CENTERS[version]) placeAlignment(matrix, row, column);
  reserveFormatAreas(matrix);
  placeVersion(matrix, version);
  return matrix;
}

const maskCondition = (mask, row, column) => [
  (row + column) % 2 === 0,
  row % 2 === 0,
  column % 3 === 0,
  (row + column) % 3 === 0,
  (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0,
  (row * column) % 2 + (row * column) % 3 === 0,
  ((row * column) % 2 + (row * column) % 3) % 2 === 0,
  ((row + column) % 2 + (row * column) % 3) % 2 === 0,
][mask];

function placeData(base, codewords, mask) {
  const matrix = {
    values:base.values.map((row) => [...row]),
    reserved:base.reserved.map((row) => [...row]),
  };
  const bits = codewords.flatMap((byte) => Array.from({ length:8 }, (_, index) => (byte >> (7 - index)) & 1));
  const size = matrix.values.length;
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right -= 1;
    for (let offset = 0; offset < size; offset += 1) {
      const row = upward ? size - 1 - offset : offset;
      for (let delta = 0; delta < 2; delta += 1) {
        const column = right - delta;
        if (matrix.reserved[row][column]) continue;
        const bit = bits[bitIndex] || 0;
        matrix.values[row][column] = Boolean(bit ^ (maskCondition(mask, row, column) ? 1 : 0));
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
  placeFormat(matrix, mask);
  return matrix.values;
}

function penalty(matrix) {
  const size = matrix.length;
  let score = 0;
  const lines = [...matrix, ...Array.from({ length:size }, (_, column) => matrix.map((row) => row[column]))];
  for (const line of lines) {
    let run = 1;
    for (let index = 1; index < size; index += 1) {
      if (line[index] === line[index - 1]) run += 1;
      else {
        if (run >= 5) score += 3 + run - 5;
        run = 1;
      }
    }
    if (run >= 5) score += 3 + run - 5;
    const pattern = '10111010000';
    const reverse = '00001011101';
    const text = line.map(Number).join('');
    for (let index = 0; index <= size - 11; index += 1) if ([pattern, reverse].includes(text.slice(index, index + 11))) score += 40;
  }
  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const total = Number(matrix[row][column]) + Number(matrix[row + 1][column]) + Number(matrix[row][column + 1]) + Number(matrix[row + 1][column + 1]);
      if (total === 0 || total === 4) score += 3;
    }
  }
  const dark = matrix.flat().filter(Boolean).length;
  score += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
  return score;
}

export function createQrMatrix(text) {
  const version = chooseVersion(new TextEncoder().encode(text).length);
  const codewords = createCodewords(text, version);
  const base = buildBaseMatrix(version);
  const candidates = Array.from({ length:8 }, (_, mask) => placeData(base, codewords, mask));
  return candidates.sort((first, second) => penalty(first) - penalty(second))[0];
}

export function createQrSvg(text, options = {}) {
  const matrix = createQrMatrix(text);
  const quiet = 4;
  const size = matrix.length + quiet * 2;
  const foreground = options.foreground || '#171426';
  const background = options.background || '#ffffff';
  const modules = [];
  matrix.forEach((row, rowIndex) => row.forEach((dark, columnIndex) => {
    if (dark) modules.push(`<rect x="${columnIndex + quiet}" y="${rowIndex + quiet}" width="1" height="1"/>`);
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR code" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${background}"/><g fill="${foreground}">${modules.join('')}</g></svg>`;
}

export async function scanQrFile(file) {
  if (!('BarcodeDetector' in globalThis)) throw new Error('QR scanning is not supported by this browser');
  const formats = await BarcodeDetector.getSupportedFormats();
  if (!formats.includes('qr_code')) throw new Error('QR scanning is not supported by this browser');
  const detector = new BarcodeDetector({ formats:['qr_code'] });
  const bitmap = await createImageBitmap(file);
  try {
    const results = await detector.detect(bitmap);
    if (!results[0]?.rawValue) throw new Error('No QR code found');
    return results[0].rawValue;
  } finally {
    bitmap.close();
  }
}
