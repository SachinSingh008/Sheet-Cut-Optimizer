import type { NestedSheet, PlacedPart } from "./nesting";

export type CutType =
  | "guillotine-rip"
  | "guillotine-cross"
  | "continuous-strip"
  | "common-wall"
  | "part-contour";

export type Point2D = {
  x: number;
  y: number;
};

export type CutSegment = {
  id: string;
  type: CutType;
  start: Point2D;
  end: Point2D;
  length: number;
  axis: "horizontal" | "vertical" | "diagonal";
  associatedPartKeys: string[];
  associatedItems: string[];
  guillotineStage: number; // 1: Major Rip, 2: Cross Strip, 3: Contour/Sizing
  isCommonCut: boolean;
  isContinuousStrip: boolean;
};

export type CuttingOperation = {
  sequenceNumber: number;
  segment: CutSegment;
  piercePoint: Point2D;
  endPoint: Point2D;
  cutLength: number;
  rapidTraverseDistance: number;
  estimatedCutTimeSec: number;
  estimatedRapidTimeSec: number;
  instruction: string;
  cumulativeCutLength: number;
  cumulativeRapidTraverse: number;
};

export type SheetCuttingSequenceResult = {
  sheetId: string;
  material: string;
  thickness: number;
  totalCutLength: number; // mm
  totalRapidTraverse: number; // mm
  totalPierces: number;
  commonCutLength: number; // mm
  savedCutLength: number; // mm saved by common walls & continuous strip cuts
  savedPierces: number; // pierces eliminated by continuous strip & common cuts
  timeSavingsPercent: number;
  totalCutTimeSec: number;
  totalRapidTimeSec: number;
  totalPierceTimeSec: number;
  totalEstimatedTimeSec: number;
  guillotineStagesCount: number;
  operations: CuttingOperation[];
  summaryByCutType: Record<CutType, { count: number; totalLength: number }>;
};

/** Default machine feed and traverse parameters (Oxy-fuel / Plasma / Shear) */
export type CuttingMachineParams = {
  cutFeedRateMmMin?: number; // mm/min (e.g. 1200 - 3000 mm/min based on thickness)
  rapidTraverseSpeedMmMin?: number; // mm/min (e.g. 15,000 mm/min)
  pierceDelaySec?: number; // seconds per pierce (e.g. 2.0 - 3.5s)
};

/**
  * Calculate Euclidean distance between two 2D points.
  */
function distance(p1: Point2D, p2: Point2D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

type InternalRawEdge = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  partKey: string;
  item: string;
  axis: "horizontal" | "vertical";
};

/**
 * Extracts, merges, and optimizes production cutting sequence for a nested sheet.
 *
 * Requirements satisfied:
 * - Minimize machine travel (Nearest-neighbor & direction-aware TSP pathing)
 * - Group common cuts (Shared wall merging)
 * - Support guillotine cuts (Stage 1 rip, Stage 2 cross, Stage 3 sizing cuts)
 * - Support continuous strip cuts (Collinear multi-part strip cut consolidation)
 * - Generate ordered cut list with step-by-step instructions
 */
export function generateCuttingSequence(
  sheet: NestedSheet,
  machineParams: CuttingMachineParams = {}
): SheetCuttingSequenceResult {
  const thickness = sheet.thickness || 10;
  // Dynamic feed rate based on plate thickness: thinner plates cut faster
  const cutFeedRate =
    machineParams.cutFeedRateMmMin ?? Math.max(800, Math.min(3500, Math.round(4500 / Math.sqrt(thickness))));
  const rapidSpeed = machineParams.rapidTraverseSpeedMmMin ?? 18000; // 300 mm/sec
  const pierceDelay = machineParams.pierceDelaySec ?? 2.5;

  const placed = sheet.placed;

  if (!placed || placed.length === 0) {
    return {
      sheetId: sheet.id,
      material: sheet.material,
      thickness: sheet.thickness,
      totalCutLength: 0,
      totalRapidTraverse: 0,
      totalPierces: 0,
      commonCutLength: 0,
      savedCutLength: 0,
      savedPierces: 0,
      timeSavingsPercent: 0,
      totalCutTimeSec: 0,
      totalRapidTimeSec: 0,
      totalPierceTimeSec: 0,
      totalEstimatedTimeSec: 0,
      guillotineStagesCount: 0,
      operations: [],
      summaryByCutType: {
        "guillotine-rip": { count: 0, totalLength: 0 },
        "guillotine-cross": { count: 0, totalLength: 0 },
        "continuous-strip": { count: 0, totalLength: 0 },
        "common-wall": { count: 0, totalLength: 0 },
        "part-contour": { count: 0, totalLength: 0 },
      },
    };
  }

  // STEP 1: Extract all part boundary edge segments
  const rawEdges: InternalRawEdge[] = [];
  let unoptimizedTotalPerimeter = 0;
  let unoptimizedPierces = placed.length * 4;

  for (const p of placed) {
    const x1 = Math.round(p.x);
    const y1 = Math.round(p.y);
    const x2 = Math.round(p.x + p.w);
    const y2 = Math.round(p.y + p.h);

    const w = x2 - x1;
    const h = y2 - y1;
    unoptimizedTotalPerimeter += 2 * (w + h);

    // Top edge
    rawEdges.push({ x1, y1, x2, y2: y1, partKey: p.key, item: p.part.item, axis: "horizontal" });
    // Bottom edge
    rawEdges.push({ x1, y1: y2, x2, y2, partKey: p.key, item: p.part.item, axis: "horizontal" });
    // Left edge
    rawEdges.push({ x1, y1, x2: x1, y2, partKey: p.key, item: p.part.item, axis: "vertical" });
    // Right edge
    rawEdges.push({ x1: x2, y1, x2, y2, partKey: p.key, item: p.part.item, axis: "vertical" });
  }

  // STEP 2: Detect Guillotine Cut Lines (Rip & Cross Cuts)
  // A horizontal guillotine cut is at Y=y_val spanning across part bounding boxes
  const horizYLines = new Set<number>();
  const vertXLines = new Set<number>();

  for (const p of placed) {
    horizYLines.add(Math.round(p.y));
    horizYLines.add(Math.round(p.y + p.h));
    vertXLines.add(Math.round(p.x));
    vertXLines.add(Math.round(p.x + p.w));
  }

  // STEP 3: Merge Collinear Edges & Identify Common Wall / Continuous Strip Cuts
  const consolidatedSegments: CutSegment[] = [];
  let segmentCounter = 1;

  // 3a. Horizontal Edge Consolidation (Group by Y coordinate)
  const horizMap = new Map<number, InternalRawEdge[]>();
  for (const edge of rawEdges) {
    if (edge.axis === "horizontal") {
      const list = horizMap.get(edge.y1) ?? [];
      list.push(edge);
      horizMap.set(edge.y1, list);
    }
  }

  for (const [y, edges] of horizMap.entries()) {
    // Sort edges along X coordinate
    edges.sort((a, b) => a.x1 - b.x1);

    // Process overlapping or adjacent intervals
    let i = 0;
    while (i < edges.length) {
      const edgeI = edges[i]!;
      let curX1 = edgeI.x1;
      let curX2 = edgeI.x2;
      const keys = new Set<string>([edgeI.partKey]);
      const items = new Set<string>([edgeI.item]);
      let commonOverlapCount = 1;

      let j = i + 1;
      while (j < edges.length) {
        const next = edges[j];
        if (!next) { j++; continue; }
        // Check if overlapping or touching
        if (next.x1 <= curX2 + 1) {
          if (next.x1 === curX1 && next.x2 === curX2) {
            // Exact same wall shared by 2 adjacent parts! (Common Wall Cut)
            commonOverlapCount++;
          }
          curX2 = Math.max(curX2, next.x2);
          keys.add(next.partKey);
          items.add(next.item);
          j++;
        } else {
          break;
        }
      }

      const segLength = curX2 - curX1;
      if (segLength > 0) {
        const isSpanningFullSheet = curX1 <= 50 && curX2 >= sheet.sheetLength - 50;
        const isMultiPartStrip = keys.size > 1;
        const isCommon = commonOverlapCount > 1 || (isMultiPartStrip && !isSpanningFullSheet);

        let type: CutType = "part-contour";
        let stage = 3;

        if (isSpanningFullSheet) {
          type = "guillotine-rip";
          stage = 1;
        } else if (isMultiPartStrip && isCommon) {
          type = "continuous-strip";
          stage = 2;
        } else if (isCommon) {
          type = "common-wall";
          stage = 2;
        } else {
          type = "part-contour";
          stage = 3;
        }

        consolidatedSegments.push({
          id: `cut-h-${segmentCounter++}`,
          type,
          start: { x: curX1, y },
          end: { x: curX2, y },
          length: segLength,
          axis: "horizontal",
          associatedPartKeys: Array.from(keys),
          associatedItems: Array.from(items),
          guillotineStage: stage,
          isCommonCut: isCommon,
          isContinuousStrip: isMultiPartStrip,
        });
      }

      i = j;
    }
  }

  // 3b. Vertical Edge Consolidation (Group by X coordinate)
  const vertMap = new Map<number, InternalRawEdge[]>();
  for (const edge of rawEdges) {
    if (edge.axis === "vertical") {
      const list = vertMap.get(edge.x1) ?? [];
      list.push(edge);
      vertMap.set(edge.x1, list);
    }
  }

  for (const [x, edges] of vertMap.entries()) {
    // Sort edges along Y coordinate
    edges.sort((a, b) => a.y1 - b.y1);

    let i = 0;
    while (i < edges.length) {
      const edgeI = edges[i]!;
      let curY1 = edgeI.y1;
      let curY2 = edgeI.y2;
      const keys = new Set<string>([edgeI.partKey]);
      const items = new Set<string>([edgeI.item]);
      let commonOverlapCount = 1;

      let j = i + 1;
      while (j < edges.length) {
        const next = edges[j];
        if (!next) { j++; continue; }
        if (next.y1 <= curY2 + 1) {
          if (next.y1 === curY1 && next.y2 === curY2) {
            commonOverlapCount++;
          }
          curY2 = Math.max(curY2, next.y2);
          keys.add(next.partKey);
          items.add(next.item);
          j++;
        } else {
          break;
        }
      }

      const segLength = curY2 - curY1;
      if (segLength > 0) {
        const isSpanningFullHeight = curY1 <= 50 && curY2 >= sheet.sheetWidth - 50;
        const isMultiPartStrip = keys.size > 1;
        const isCommon = commonOverlapCount > 1 || (isMultiPartStrip && !isSpanningFullHeight);

        let type: CutType = "part-contour";
        let stage = 3;

        if (isSpanningFullHeight) {
          type = "guillotine-cross";
          stage = 1;
        } else if (isMultiPartStrip && isCommon) {
          type = "continuous-strip";
          stage = 2;
        } else if (isCommon) {
          type = "common-wall";
          stage = 2;
        } else {
          type = "part-contour";
          stage = 3;
        }

        consolidatedSegments.push({
          id: `cut-v-${segmentCounter++}`,
          type,
          start: { x, y: curY1 },
          end: { x, y: curY2 },
          length: segLength,
          axis: "vertical",
          associatedPartKeys: Array.from(keys),
          associatedItems: Array.from(items),
          guillotineStage: stage,
          isCommonCut: isCommon,
          isContinuousStrip: isMultiPartStrip,
        });
      }

      i = j;
    }
  }

  // STEP 4: Machine Travel Minimization (Direction-Aware Nearest-Neighbor Path Ordering)
  // We start at Machine Home (0, 0)
  let currentPos: Point2D = { x: 0, y: 0 };
  const unvisited = [...consolidatedSegments];
  const operations: CuttingOperation[] = [];

  let cumulativeCut = 0;
  let cumulativeRapid = 0;
  let commonCutLength = 0;
  let opSeqNum = 1;

  const summaryByCutType: Record<CutType, { count: number; totalLength: number }> = {
    "guillotine-rip": { count: 0, totalLength: 0 },
    "guillotine-cross": { count: 0, totalLength: 0 },
    "continuous-strip": { count: 0, totalLength: 0 },
    "common-wall": { count: 0, totalLength: 0 },
    "part-contour": { count: 0, totalLength: 0 },
  };

  while (unvisited.length > 0) {
    // Stage-Aware Priority: Sort remaining by stage first (Stage 1 cuts -> Stage 2 -> Stage 3),
    // then choose the nearest segment to current machine torch position
    let bestIdx = -1;
    let bestDist = Infinity;
    let flipDirection = false;

    // Find the minimum active stage among remaining segments
    let minActiveStage = 4;
    for (const seg of unvisited) {
      if (seg.guillotineStage < minActiveStage) {
        minActiveStage = seg.guillotineStage;
      }
    }

    for (let idx = 0; idx < unvisited.length; idx++) {
      const seg = unvisited[idx];
      if (!seg) continue;
      // Only consider cuts in the current active stage to maintain structural plate stability & guillotine shear flow
      if (seg.guillotineStage !== minActiveStage) continue;

      const dStart = distance(currentPos, seg.start);
      const dEnd = distance(currentPos, seg.end);

      if (dStart < bestDist) {
        bestDist = dStart;
        bestIdx = idx;
        flipDirection = false;
      }
      if (dEnd < bestDist) {
        bestDist = dEnd;
        bestIdx = idx;
        flipDirection = true;
      }
    }

    // Fallback if stage filter didn't match (safety)
    if (bestIdx === -1) {
      for (let idx = 0; idx < unvisited.length; idx++) {
        const seg = unvisited[idx];
        if (!seg) continue;
        const dStart = distance(currentPos, seg.start);
        const dEnd = distance(currentPos, seg.end);

        if (dStart < bestDist) {
          bestDist = dStart;
          bestIdx = idx;
          flipDirection = false;
        }
        if (dEnd < bestDist) {
          bestDist = dEnd;
          bestIdx = idx;
          flipDirection = true;
        }
      }
    }

    if (bestIdx === -1) break; // safety — no segment found
    const chosenSeg = unvisited[bestIdx]!;
    unvisited.splice(bestIdx, 1);

    const piercePt = flipDirection ? chosenSeg.end : chosenSeg.start;
    const endPt = flipDirection ? chosenSeg.start : chosenSeg.end;
    const rapidDist = Math.round(distance(currentPos, piercePt));

    cumulativeCut += chosenSeg.length;
    cumulativeRapid += rapidDist;

    if (chosenSeg.isCommonCut || chosenSeg.isContinuousStrip) {
      commonCutLength += chosenSeg.length;
    }

    summaryByCutType[chosenSeg.type].count++;
    summaryByCutType[chosenSeg.type].totalLength += chosenSeg.length;

    // Generate human-readable operator instruction
    let instruction = "";
    const itemsStr = chosenSeg.associatedItems.slice(0, 3).join(", ");
    const moreStr = chosenSeg.associatedItems.length > 3 ? ` +${chosenSeg.associatedItems.length - 3} more` : "";

    switch (chosenSeg.type) {
      case "guillotine-rip":
        instruction = `Stage 1 Guillotine Rip Cut at Y=${piercePt.y}mm from X=${piercePt.x} to X=${endPt.x}mm (${chosenSeg.length}mm)`;
        break;
      case "guillotine-cross":
        instruction = `Stage 1 Guillotine Cross Cut at X=${piercePt.x}mm from Y=${piercePt.y} to Y=${endPt.y}mm (${chosenSeg.length}mm)`;
        break;
      case "continuous-strip":
        instruction = `Stage 2 Continuous Strip Cut (${itemsStr}${moreStr}) — ${chosenSeg.axis === "horizontal" ? `Y=${piercePt.y}mm` : `X=${piercePt.x}mm`} [Length: ${chosenSeg.length}mm]`;
        break;
      case "common-wall":
        instruction = `Stage 2 Shared Common Wall Cut between ${itemsStr} [Length: ${chosenSeg.length}mm]`;
        break;
      case "part-contour":
        instruction = `Stage 3 Part Sizing Cut for ${itemsStr} [Length: ${chosenSeg.length}mm]`;
        break;
    }

    const cutTimeSec = (chosenSeg.length / cutFeedRate) * 60;
    const rapidTimeSec = (rapidDist / rapidSpeed) * 60;

    operations.push({
      sequenceNumber: opSeqNum++,
      segment: chosenSeg,
      piercePoint: piercePt,
      endPoint: endPt,
      cutLength: chosenSeg.length,
      rapidTraverseDistance: rapidDist,
      estimatedCutTimeSec: Number(cutTimeSec.toFixed(1)),
      estimatedRapidTimeSec: Number(rapidTimeSec.toFixed(1)),
      instruction,
      cumulativeCutLength: Math.round(cumulativeCut),
      cumulativeRapidTraverse: Math.round(cumulativeRapid),
    });

    currentPos = endPt;
  }

  const totalPierces = operations.length;
  const totalCutLength = Math.round(cumulativeCut);
  const totalRapidTraverse = Math.round(cumulativeRapid);
  const savedCutLength = Math.max(0, unoptimizedTotalPerimeter - totalCutLength);
  const savedPierces = Math.max(0, unoptimizedPierces - totalPierces);

  const totalCutTimeSec = Number(((totalCutLength / cutFeedRate) * 60).toFixed(1));
  const totalRapidTimeSec = Number(((totalRapidTraverse / rapidSpeed) * 60).toFixed(1));
  const totalPierceTimeSec = Number((totalPierces * pierceDelay).toFixed(1));
  const totalEstimatedTimeSec = Number(
    (totalCutTimeSec + totalRapidTimeSec + totalPierceTimeSec).toFixed(1)
  );

  const unoptimizedCutTimeSec = (unoptimizedTotalPerimeter / cutFeedRate) * 60 + unoptimizedPierces * pierceDelay;
  const timeSavingsPercent =
    unoptimizedCutTimeSec > 0
      ? Number(
          (
            ((unoptimizedCutTimeSec - totalEstimatedTimeSec) / unoptimizedCutTimeSec) *
            100
          ).toFixed(1)
        )
      : 0;

  const stagesUsed = new Set(operations.map((o) => o.segment.guillotineStage)).size;

  return {
    sheetId: sheet.id,
    material: sheet.material,
    thickness: sheet.thickness,
    totalCutLength,
    totalRapidTraverse,
    totalPierces,
    commonCutLength: Math.round(commonCutLength),
    savedCutLength,
    savedPierces,
    timeSavingsPercent: Math.max(0, timeSavingsPercent),
    totalCutTimeSec,
    totalRapidTimeSec,
    totalPierceTimeSec,
    totalEstimatedTimeSec,
    guillotineStagesCount: stagesUsed,
    operations,
    summaryByCutType,
  };
}
