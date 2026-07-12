// Repacks character sprite sheets whose art has drifted off the declared
// uniform frame grid (hand-assembled or AI-generated sheets). Segments the
// actual sprites via connected components, then re-lays each one out
// centered and bottom-aligned in its proper cell. Broken frames (split or
// oversized components, missing cells) are patched with the nearest clean
// frame from the same row. Pure Node (zlib only): 8-bit RGBA PNGs.
//
// Usage: node tools/repack-sheets.mjs <sheet.png> <frameWidth> <frameHeight> [baselineInset]
//        (writes in place; keep a backup of the original)
import fs from 'node:fs';
import zlib from 'node:zlib';

const [, , file, frameWidthArg, frameHeightArg, baselineInsetArg] = process.argv;
if (!file) {
  console.error('usage: node tools/repack-sheets.mjs <sheet.png> <frameWidth> <frameHeight> [baselineInset]');
  process.exit(1);
}
const frameWidth = Number(frameWidthArg || 192);
const frameHeight = Number(frameHeightArg || 256);
const baselineInset = Number(baselineInsetArg || 16);
const INK_THRESHOLD = 80; // segmentation ignores faint generation residue
const SCRUB_ALPHA = 20; // and the repack drops it entirely
const MIN_GROUP_AREA = 800;

// ---------- PNG decode ----------
function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) {
        throw new Error('only 8-bit RGBA non-interlaced PNGs are supported');
      }
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(width * height * 4);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? out[x - 4] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= 4 && prev ? prev[x - 4] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[x] = value & 0xff;
    }
  }
  return { width, height, pixels };
}

// ---------- PNG encode ----------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(...buffers) {
  let crc = -1;
  buffers.forEach(buf => {
    for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.from(type, 'ascii'), data), 8 + data.length);
  return out;
}

function encodePng(width, height, pixels) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------- segmentation ----------
const { width, height, pixels } = decodePng(fs.readFileSync(file));
const columns = Math.round(width / frameWidth);
const rows = Math.round(height / frameHeight);
const stride = width * 4;
console.log(`${file}: ${width}x${height}, grid ${columns}x${rows} @ ${frameWidth}x${frameHeight}`);

const labels = new Int32Array(width * height).fill(-1);
const components = [];
const stack = new Int32Array(width * height);

function ink(index) {
  return pixels[index * 4 + 3] > INK_THRESHOLD;
}

for (let start = 0; start < width * height; start++) {
  if (labels[start] !== -1 || !ink(start)) continue;
  const id = components.length;
  const comp = { id, minX: width, maxX: 0, minY: height, maxY: 0, area: 0 };
  let top = 0;
  stack[top++] = start;
  labels[start] = id;
  while (top > 0) {
    const index = stack[--top];
    const x = index % width;
    const y = (index / width) | 0;
    comp.area++;
    if (x < comp.minX) comp.minX = x;
    if (x > comp.maxX) comp.maxX = x;
    if (y < comp.minY) comp.minY = y;
    if (y > comp.maxY) comp.maxY = y;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (labels[ni] === -1 && ink(ni)) {
          labels[ni] = id;
          stack[top++] = ni;
        }
      }
    }
  }
  components.push(comp);
}

// Pre-pass: rejoin sprites the generator split with transparent grid seams.
// Fragments join when they are strongly aligned on one axis and nearly
// touching on the other (seam gaps are a few pixels wide).
const big = components.filter(comp => comp.area >= 60);
const parent = big.map((_, index) => index);
function find(i) {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]];
    i = parent[i];
  }
  return i;
}
function shouldJoin(a, b) {
  const xOverlap = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) + 1;
  const yOverlap = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) + 1;
  const minWidth = Math.min(a.maxX - a.minX, b.maxX - b.minX) + 1;
  const minHeight = Math.min(a.maxY - a.minY, b.maxY - b.minY) + 1;
  const yGap = Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY);
  const xGap = Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX);
  // Seam lines are only a few pixels wide; genuine neighboring frames sit
  // 20px+ apart. Keep the join gap tight so rows/columns never chain, and
  // require the rejoined sprite to still fit a frame (joining two real
  // neighbors would exceed it).
  const mergedWidth = Math.max(a.maxX, b.maxX) - Math.min(a.minX, b.minX) + 1;
  const mergedHeight = Math.max(a.maxY, b.maxY) - Math.min(a.minY, b.minY) + 1;
  if (mergedWidth > frameWidth || mergedHeight > frameHeight) return false;
  const verticalSplit = xOverlap >= minWidth * 0.6 && yGap <= 8;
  const horizontalSplit = yOverlap >= minHeight * 0.6 && xGap <= 8;
  return verticalSplit || horizontalSplit;
}
for (let i = 0; i < big.length; i++) {
  for (let j = i + 1; j < big.length; j++) {
    if (find(i) === find(j)) continue;
    if (shouldJoin(big[i], big[j])) parent[find(j)] = find(i);
  }
}
const superComponents = new Map();
big.forEach((comp, index) => {
  const root = find(index);
  const entry = superComponents.get(root);
  if (!entry) {
    superComponents.set(root, { members: [comp], minX: comp.minX, maxX: comp.maxX, minY: comp.minY, maxY: comp.maxY, area: comp.area });
  } else {
    entry.members.push(comp);
    entry.minX = Math.min(entry.minX, comp.minX);
    entry.maxX = Math.max(entry.maxX, comp.maxX);
    entry.minY = Math.min(entry.minY, comp.minY);
    entry.maxY = Math.max(entry.maxY, comp.maxY);
    entry.area += comp.area;
  }
});

// Cluster rejoined sprites into rows at the natural breaks: sort by
// y-center and split where consecutive centers jump the most. This holds
// up even when whole rows drift far from their nominal cell centers.
const entries = [...superComponents.values()]
  .filter(entry => entry.area >= MIN_GROUP_AREA)
  .sort((a, b) => (a.minY + a.maxY) - (b.minY + b.maxY));
const gaps = [];
for (let i = 1; i < entries.length; i++) {
  const prev = (entries[i - 1].minY + entries[i - 1].maxY) / 2;
  const next = (entries[i].minY + entries[i].maxY) / 2;
  gaps.push({ index: i, size: next - prev, mid: (prev + next) / 2 });
}
// For each nominal row boundary, take the largest center-gap that falls
// within half a frame of it; drifted rows keep their own break points.
const breakIndices = [];
for (let k = 1; k < rows; k++) {
  const boundary = k * frameHeight;
  const candidates = gaps.filter(gap =>
    Math.abs(gap.mid - boundary) <= frameHeight / 2 && !breakIndices.includes(gap.index)
  );
  if (!candidates.length) continue;
  breakIndices.push(candidates.reduce((a, b) => (a.size >= b.size ? a : b)).index);
}
breakIndices.sort((a, b) => a - b);
const rowClusters = [];
let cursor = 0;
[...breakIndices, entries.length].forEach(end => {
  rowClusters.push(entries.slice(cursor, end));
  cursor = end;
});
while (rowClusters.length < rows) rowClusters.push([]);

// merge x-overlapping components within a row into groups (split sprites)
function buildGroups(comps) {
  const sorted = [...comps].sort((a, b) => a.minX - b.minX);
  const groups = [];
  sorted.forEach(comp => {
    // Join only substantially x-aligned fragments (vertically split sprites);
    // a small arm overlap with the neighboring sprite must NOT merge them.
    const open = groups.find(group => {
      const overlap = Math.min(comp.maxX, group.maxX) - Math.max(comp.minX, group.minX) + 1;
      const smaller = Math.min(comp.maxX - comp.minX, group.maxX - group.minX) + 1;
      return overlap >= smaller * 0.5;
    });
    if (open) {
      open.members.push(...comp.members);
      open.minX = Math.min(open.minX, comp.minX);
      open.maxX = Math.max(open.maxX, comp.maxX);
      open.minY = Math.min(open.minY, comp.minY);
      open.maxY = Math.max(open.maxY, comp.maxY);
      open.area += comp.area;
    } else {
      groups.push({ members: [...comp.members], minX: comp.minX, maxX: comp.maxX, minY: comp.minY, maxY: comp.maxY, area: comp.area });
    }
  });
  return groups.filter(group => group.area >= MIN_GROUP_AREA);
}

const out = Buffer.alloc(pixels.length);

function drawGroup(group, row, col) {
  const groupWidth = group.maxX - group.minX + 1;
  const cellX = col * frameWidth;
  const cellY = row * frameHeight;
  const offsetX = cellX + Math.round((frameWidth - groupWidth) / 2) - group.minX;
  const targetBottom = cellY + frameHeight - 1 - baselineInset;
  const offsetY = targetBottom - group.maxY;
  const memberIds = new Set(group.members.map(member => member.id));
  for (let y = group.minY; y <= group.maxY; y++) {
    const destY = y + offsetY;
    if (destY < cellY || destY >= cellY + frameHeight) continue;
    for (let x = group.minX; x <= group.maxX; x++) {
      const destX = x + offsetX;
      if (destX < cellX || destX >= cellX + frameWidth) continue;
      const srcIndex = y * width + x;
      if (labels[srcIndex] === -1 || !memberIds.has(labels[srcIndex])) {
        // keep soft AA/shadow pixels that hug the component
        if (pixels[srcIndex * 4 + 3] <= SCRUB_ALPHA) continue;
      }
      if (pixels[srcIndex * 4 + 3] <= SCRUB_ALPHA) continue;
      pixels.copy(out, (destY * width + destX) * 4, srcIndex * 4, srcIndex * 4 + 4);
    }
  }
}

// Physically connected neighbors form one over-wide component; watershed
// them apart at the column with the least ink between the two figures.
function splitWideGroup(group) {
  const width_ = group.maxX - group.minX + 1;
  if (width_ <= frameWidth) return [group];
  const memberIds = new Set(group.members.map(member => member.id));
  const inkPerColumn = new Array(width_).fill(0);
  for (let y = group.minY; y <= group.maxY; y++) {
    for (let x = group.minX; x <= group.maxX; x++) {
      const index = y * width + x;
      if (labels[index] !== -1 && memberIds.has(labels[index])) inkPerColumn[x - group.minX]++;
    }
  }
  // search the middle half for the sparsest column
  let splitOffset = Math.floor(width_ / 2);
  let least = Infinity;
  for (let offset = Math.floor(width_ * 0.25); offset < width_ * 0.75; offset++) {
    if (inkPerColumn[offset] < least) {
      least = inkPerColumn[offset];
      splitOffset = offset;
    }
  }
  const splitX = group.minX + splitOffset;
  const tighten = half => {
    const box = { ...half, minX: width, maxX: 0, minY: height, maxY: 0, area: 0 };
    for (let y = group.minY; y <= group.maxY; y++) {
      for (let x = half.minX; x <= half.maxX; x++) {
        const index = y * width + x;
        if (labels[index] !== -1 && memberIds.has(labels[index])) {
          if (x < box.minX) box.minX = x;
          if (x > box.maxX) box.maxX = x;
          if (y < box.minY) box.minY = y;
          if (y > box.maxY) box.maxY = y;
          box.area++;
        }
      }
    }
    return box.area >= MIN_GROUP_AREA ? box : null;
  };
  const left = tighten({ ...group, members: group.members, minX: group.minX, maxX: splitX - 1 });
  const right = tighten({ ...group, members: group.members, minX: splitX, maxX: group.maxX });
  return [...(left ? splitWideGroup(left) : []), ...(right ? splitWideGroup(right) : [])];
}

for (let row = 0; row < rows; row++) {
  let groups = buildGroups(rowClusters[row]).flatMap(splitWideGroup);
  groups.sort((a, b) => a.minX - b.minX);
  // drop partials cut off by the image edge when there are too many
  while (groups.length > columns) {
    const edge = groups.find(group => group.maxX >= width - 2 || group.minX <= 1);
    if (edge) groups.splice(groups.indexOf(edge), 1);
    else groups.splice(groups.indexOf(groups.reduce((a, b) => (a.area < b.area ? a : b))), 1);
  }
  groups.sort((a, b) => a.minX - b.minX);
  const valid = groups.filter(group =>
    group.maxY - group.minY + 1 <= frameHeight - baselineInset &&
    group.maxX - group.minX + 1 <= frameWidth
  );
  const report = [];
  for (let col = 0; col < columns; col++) {
    let group = groups[col];
    let note = 'ok';
    if (!group || !valid.includes(group)) {
      // patch broken or missing frame with the nearest clean one
      const source = valid.length
        ? valid.reduce((a, b) => {
            const target = col * frameWidth + frameWidth / 2;
            const da = Math.abs((a.minX + a.maxX) / 2 - target);
            const db = Math.abs((b.minX + b.maxX) / 2 - target);
            return da <= db ? a : b;
          })
        : null;
      if (!source) {
        report.push(`col${col}:EMPTY`);
        continue;
      }
      group = source;
      note = 'patched';
    }
    drawGroup(group, row, col);
    report.push(`col${col}:${note}`);
  }
  console.log(`row ${row}: ${report.join(' ')}`);
}

fs.writeFileSync(file, encodePng(width, height, out));
console.log('repacked in place.');
