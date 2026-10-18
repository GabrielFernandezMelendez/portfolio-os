import { TrackGenerator } from './track-generator';

const COLORS = {
  grass: '#2d5a1e',
  grassAlt: '#3a7028',
  grassDark: '#245216',
  asphalt: '#333344',
  asphaltNoise: '#3a3a50',
  railCenter: '#666680',
  curbRed: '#e63946',
  curbWhite: '#f1faee',
  finishWhite: '#ffffff',
  finishBlack: '#111111',
  treeTrunk: '#4a3728',
  treeTop: '#1a5c0a',
  treeTopAlt: '#237012',
  treeTopDark: '#0e4205',
  treeShadow: '#1e4a14',
};

// Seeded random for deterministic placement
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Cache entire static scene into one offscreen canvas
let sceneCanvas: HTMLCanvasElement | null = null;
let sceneCacheKey = '';
let treePositions: { x: number; y: number; size: number; variant: number }[] = [];

export function renderTrack(
  ctx: CanvasRenderingContext2D,
  track: TrackGenerator,
  canvasWidth: number,
  canvasHeight: number
): void {
  const cacheKey = `${canvasWidth}-${canvasHeight}`;

  if (!sceneCanvas || sceneCacheKey !== cacheKey) {
    // Build entire static scene once
    sceneCanvas = document.createElement('canvas');
    sceneCanvas.width = canvasWidth;
    sceneCanvas.height = canvasHeight;
    const sCtx = sceneCanvas.getContext('2d')!;

    drawGrass(sCtx, canvasWidth, canvasHeight);
    drawRoadSurface(sCtx, track, canvasWidth, canvasHeight);
    drawCurbs(sCtx, track);
    drawRails(sCtx, track);
    drawFinishLine(sCtx, track);
    generateTreePositions(track);
    drawTrees(sCtx);

    sceneCacheKey = cacheKey;
  }

  // drawImage respects canvas transforms (translate/scale)
  // so the scene moves with the camera
  ctx.drawImage(sceneCanvas, 0, 0);
}

function drawGrass(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, width, height);

  let seed = 0;
  for (let x = 0; x < width; x += 4) {
    for (let y = 0; y < height; y += 4) {
      seed++;
      if (seededRandom(seed) < 0.25) {
        ctx.fillStyle = seededRandom(seed * 2) < 0.5 ? COLORS.grassAlt : COLORS.grassDark;
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }
}

function drawRoadSurface(
  ctx: CanvasRenderingContext2D,
  track: TrackGenerator,
  canvasWidth: number,
  canvasHeight: number
): void {
  const sampleCount = track.getSampleCount();
  const totalLength = track.getTotalLength();

  const road = new Path2D();
  for (let i = 0; i <= sampleCount; i++) {
    const d = (i / sampleCount) * totalLength;
    const outerWall = track.getWallPosition(d, 'outer');
    if (i === 0) road.moveTo(outerWall.x, outerWall.y);
    else road.lineTo(outerWall.x, outerWall.y);
  }
  for (let i = sampleCount; i >= 0; i--) {
    const d = (i / sampleCount) * totalLength;
    const innerWall = track.getWallPosition(d, 'inner');
    road.lineTo(innerWall.x, innerWall.y);
  }
  road.closePath();

  ctx.fillStyle = COLORS.asphalt;
  ctx.fill(road);

  ctx.save();
  ctx.clip(road);
  let seed = 10000;
  for (let x = 0; x < canvasWidth; x += 4) {
    for (let y = 0; y < canvasHeight; y += 4) {
      seed++;
      if (seededRandom(seed) < 0.06) {
        ctx.fillStyle = COLORS.asphaltNoise;
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }
  ctx.restore();
}

function drawCurbs(
  ctx: CanvasRenderingContext2D,
  track: TrackGenerator
): void {
  const sampleCount = track.getSampleCount();
  const totalLength = track.getTotalLength();

  for (let i = 0; i < sampleCount; i += 2) {
    const d = (i / sampleCount) * totalLength;
    const blockIndex = Math.floor(d / 10);
    const isRed = blockIndex % 2 === 0;
    const info = track.getTrackInfo(d);

    if (Math.abs(info.curvature) > 0.008) continue;

    ctx.fillStyle = isRed ? COLORS.curbRed : COLORS.curbWhite;

    const outerWall = track.getWallPosition(d, 'outer');
    ctx.fillRect(outerWall.x - 2, outerWall.y - 2, 4, 4);

    const innerWall = track.getWallPosition(d, 'inner');
    ctx.fillRect(innerWall.x - 2, innerWall.y - 2, 4, 4);
  }
}

function drawRails(
  ctx: CanvasRenderingContext2D,
  track: TrackGenerator
): void {
  const sampleCount = track.getSampleCount();
  const totalLength = track.getTotalLength();

  const linePositions = [-0.5, 0.5, 1.5, 2.5];

  for (const laneEdge of linePositions) {
    const railPath = new Path2D();
    for (let i = 0; i <= sampleCount; i++) {
      const d = (i / sampleCount) * totalLength;
      const pos = track.getRailPosition(d, laneEdge);
      if (i === 0) railPath.moveTo(pos.x, pos.y);
      else railPath.lineTo(pos.x, pos.y);
    }

    ctx.save();
    ctx.strokeStyle = COLORS.railCenter;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 12]);
    ctx.stroke(railPath);
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function drawFinishLine(
  ctx: CanvasRenderingContext2D,
  track: TrackGenerator
): void {
  const info = track.getTrackInfo(0);
  const perpX = -Math.sin(info.tangentAngle);
  const perpY = Math.cos(info.tangentAngle);

  const innerPos = track.getRailPosition(0, 0);
  const outerPos = track.getRailPosition(0, 2);

  const startX = innerPos.x - perpX * 4;
  const startY = innerPos.y - perpY * 4;
  const endX = outerPos.x + perpX * 4;
  const endY = outerPos.y + perpY * 4;

  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.floor(length / 4);

  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < 3; j++) {
      const frac = i / steps;
      const px = startX + dx * frac + perpX * j * 4;
      const py = startY + dy * frac + perpY * j * 4;
      ctx.fillStyle = (i + j) % 2 === 0 ? COLORS.finishWhite : COLORS.finishBlack;
      ctx.fillRect(px - 2, py - 2, 4, 4);
    }
  }
}

function generateTreePositions(track: TrackGenerator): void {
  if (treePositions.length > 0) return;

  treePositions = [];
  const sampleCount = track.getSampleCount();
  const totalLength = track.getTotalLength();

  let seed = 50000;
  for (let i = 0; i < sampleCount; i += 8) {
    const d = (i / sampleCount) * totalLength;
    seed++;

    // Outer trees
    if (seededRandom(seed) < 0.35) {
      const wallPos = track.getWallPosition(d, 'outer');
      const info = track.getTrackInfo(d);
      const treeOffset = 30 + seededRandom(seed * 3) * 80;

      treePositions.push({
        x: wallPos.x + info.outwardX * treeOffset,
        y: wallPos.y + info.outwardY * treeOffset,
        size: 8 + seededRandom(seed * 5) * 8,
        variant: Math.floor(seededRandom(seed * 7) * 3),
      });
    }

    // Inner trees
    seed++;
    if (seededRandom(seed) < 0.35) {
      const wallPos = track.getWallPosition(d, 'inner');
      const info = track.getTrackInfo(d);
      const treeOffset = 30 + seededRandom(seed * 3) * 80;

      treePositions.push({
        x: wallPos.x - info.outwardX * treeOffset,
        y: wallPos.y - info.outwardY * treeOffset,
        size: 8 + seededRandom(seed * 5) * 8,
        variant: Math.floor(seededRandom(seed * 7) * 3),
      });
    }
  }
}

function drawTrees(ctx: CanvasRenderingContext2D): void {
  for (const tree of treePositions) {
    const s = tree.size;
    const px = 4;

    // Shadow
    ctx.fillStyle = COLORS.treeShadow;
    ctx.beginPath();
    ctx.ellipse(tree.x + 3, tree.y + 3, s * 0.7, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = COLORS.treeTrunk;
    ctx.fillRect(tree.x - px, tree.y - px, px * 2, px * 3);

    // Canopy
    const topColors = [COLORS.treeTop, COLORS.treeTopAlt, COLORS.treeTopDark];
    const mainColor = topColors[tree.variant];

    ctx.fillStyle = mainColor;
    ctx.fillRect(tree.x - s * 0.5, tree.y - s * 0.6, s, s * 0.7);

    // Pixel detail on canopy
    let tseed = Math.floor(tree.x * 100 + tree.y);
    for (let tx = -s * 0.5; tx < s * 0.5; tx += px) {
      for (let ty = -s * 0.6; ty < s * 0.1; ty += px) {
        tseed++;
        const dist = Math.sqrt(tx * tx + ty * ty);
        if (dist > s * 0.5) continue;

        if (seededRandom(tseed) < 0.3) {
          ctx.fillStyle = seededRandom(tseed * 2) < 0.5 ? COLORS.treeTopAlt : COLORS.treeTopDark;
          ctx.fillRect(tree.x + tx, tree.y + ty, px, px);
        }
      }
    }

    // Rounded corners
    ctx.fillStyle = COLORS.grass;
    const corners = [
      [-s * 0.5, -s * 0.6],
      [s * 0.5 - px, -s * 0.6],
      [-s * 0.5, s * 0.1 - px],
      [s * 0.5 - px, s * 0.1 - px],
    ];
    for (const [cx, cy] of corners) {
      ctx.fillRect(tree.x + cx, tree.y + cy, px, px);
    }
  }
}