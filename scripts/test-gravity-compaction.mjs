function gravityCompactSheet(sheet, kerf = 3, trim = 0) {
  const placed = sheet.placed.map(p => ({ ...p }));
  const N = placed.length;
  if (N <= 1) return { ...sheet, placed };

  let movedAny = true;
  let iterations = 0;

  while (movedAny && iterations < 20) {
    movedAny = false;
    iterations++;

    // Sort by x ascending, then y ascending
    placed.sort((a, b) => a.x - b.x || a.y - b.y);

    for (let i = 0; i < N; i++) {
      const p = placed[i];

      // 1. Try sliding LEFT (decrease X)
      let minX = trim;
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const other = placed[j];
        // Check if other is to the left of p and overlaps in Y
        const yOverlap = p.y < other.y + other.h + kerf && p.y + p.h + kerf > other.y;
        if (yOverlap && other.x + other.w + kerf <= p.x) {
          const candidateX = other.x + other.w + kerf;
          if (candidateX > minX) {
            minX = candidateX;
          }
        }
      }

      if (minX < p.x) {
        // Verify no collision at new (minX, p.y)
        let collision = false;
        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          const other = placed[j];
          const xOverlap = minX < other.x + other.w + kerf && minX + p.w + kerf > other.x;
          const yOverlap = p.y < other.y + other.h + kerf && p.y + p.h + kerf > other.y;
          if (xOverlap && yOverlap) {
            collision = true;
            break;
          }
        }
        if (!collision) {
          p.x = minX;
          movedAny = true;
        }
      }

      // 2. Try sliding DOWN (decrease Y)
      let minY = trim;
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const other = placed[j];
        // Check if other is below p and overlaps in X
        const xOverlap = p.x < other.x + other.w + kerf && p.x + p.w + kerf > other.x;
        if (xOverlap && other.y + other.h + kerf <= p.y) {
          const candidateY = other.y + other.h + kerf;
          if (candidateY > minY) {
            minY = candidateY;
          }
        }
      }

      if (minY < p.y) {
        // Verify no collision at new (p.x, minY)
        let collision = false;
        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          const other = placed[j];
          const xOverlap = p.x < other.x + other.w + kerf && p.x + p.w + kerf > other.x;
          const yOverlap = minY < other.y + other.h + kerf && minY + p.h + kerf > other.y;
          if (xOverlap && yOverlap) {
            collision = true;
            break;
          }
        }
        if (!collision) {
          p.y = minY;
          movedAny = true;
        }
      }
    }
  }

  return { ...sheet, placed };
}

// Test with an isolated part stranded at x = 2000
const testSheet = {
  id: "S02",
  sheetLength: 6000,
  sheetWidth: 1250,
  placed: [
    { key: "1", x: 0, y: 0, w: 500, h: 500 },
    { key: "2", x: 0, y: 503, w: 500, h: 500 },
    { key: "3", x: 503, y: 0, w: 300, h: 300 },
    // Stranded isolated part at x = 2000, y = 500:
    { key: "4-stranded", x: 2000, y: 500, w: 359, h: 266 },
  ]
};

console.log("Before compaction:");
testSheet.placed.forEach(p => console.log(`  ${p.key}: x=${p.x}, y=${p.y}, w=${p.w}, h=${p.h}`));
const compacted = gravityCompactSheet(testSheet, 3, 0);
console.log("\nAfter gravity compaction:");
compacted.placed.forEach(p => console.log(`  ${p.key}: x=${p.x}, y=${p.y}, w=${p.w}, h=${p.h}`));
console.log(`Max X reduced from 2359 to: ${Math.max(...compacted.placed.map(p => p.x + p.w))}`);
