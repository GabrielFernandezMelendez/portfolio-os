import { TrackConfig, TrackInfo, RailPosition } from '../domain/track.model';

// Generates a smooth closed track from waypoints using Catmull-Rom splines.
// All geometry is pure math — no DOM or framework dependency.

interface TrackPoint {
  x: number;
  y: number;
  tangentAngle: number;
  curvature: number;
  outwardX: number;
  outwardY: number;
  cumulativeDistance: number;
}

export class TrackGenerator {

  private readonly points: TrackPoint[] = [];
  private readonly totalLength: number;
  private readonly railSpacing: number;
  private readonly wallMargin: number;
  private readonly innerWallRail: number;
  private readonly outerWallRail: number;

  constructor(config: TrackConfig) {
    this.railSpacing = config.railSpacing;
    this.wallMargin = config.wallMargin;
    this.innerWallRail = 0 - this.wallMargin / this.railSpacing;
    this.outerWallRail = 2 + this.wallMargin / this.railSpacing;
    this.points = this.generatePoints(config);
    this.totalLength = this.points.length > 0
      ? this.points[this.points.length - 1].cumulativeDistance
      : 0;
  }

  getTotalLength(): number {
    return this.totalLength;
  }

  getInnerWallRail(): number {
    return this.innerWallRail;
  }

  getOuterWallRail(): number {
    return this.outerWallRail;
  }

  // Returns track geometry at a given distance along the track
  getTrackInfo(distance: number): TrackInfo {
    const d = this.normalizeDistance(distance);
    const idx = this.findSegmentIndex(d);
    const point = this.points[idx];

    return {
      x: point.x,
      y: point.y,
      tangentAngle: point.tangentAngle,
      curvature: point.curvature,
      outwardX: point.outwardX,
      outwardY: point.outwardY,
      isCurve: Math.abs(point.curvature) > 0.001,
    };
  }

  // Returns position offset by rail index (0=inner, 1=center, 2=outer)
  getRailPosition(distance: number, railIndex: number): RailPosition {
    const info = this.getTrackInfo(distance);
    const offset = (railIndex - 1) * this.railSpacing;

    return {
      x: info.x + info.outwardX * offset,
      y: info.y + info.outwardY * offset,
      tangentAngle: info.tangentAngle,
      curvature: info.curvature,
      outwardX: info.outwardX,
      outwardY: info.outwardY,
    };
  }

  // Returns wall position for rendering
  getWallPosition(distance: number, side: 'inner' | 'outer'): { x: number; y: number } {
    const info = this.getTrackInfo(distance);
    const offset = side === 'outer'
      ? (2 - 1) * this.railSpacing + this.wallMargin
      : (0 - 1) * this.railSpacing - this.wallMargin;

    return {
      x: info.x + info.outwardX * offset,
      y: info.y + info.outwardY * offset,
    };
  }

  // Generates sample count for rendering (higher = smoother)
  getSampleCount(): number {
    return this.points.length;
  }

  // Returns distance at a fraction of the total track (0..1)
  getDistanceAtFraction(fraction: number): number {
    return fraction * this.totalLength;
  }

  // ── Private: spline generation ──────────────

  private generatePoints(config: TrackConfig): TrackPoint[] {
    const waypoints = config.waypoints;
    const numWaypoints = waypoints.length;
    if (numWaypoints < 3) return [];

    const samplesPerSegment = 50;
    const rawPoints: { x: number; y: number }[] = [];

    // Catmull-Rom through all waypoints (closed loop)
    for (let i = 0; i < numWaypoints - 1; i++) {
      const p0 = waypoints[(i - 1 + numWaypoints) % numWaypoints];
      const p1 = waypoints[i];
      const p2 = waypoints[(i + 1) % numWaypoints];
      const p3 = waypoints[(i + 2) % numWaypoints];

      for (let t = 0; t < samplesPerSegment; t++) {
        const frac = t / samplesPerSegment;
        rawPoints.push(this.catmullRom(p0, p1, p2, p3, frac));
      }
    }

    // Build track points with tangent, curvature, and cumulative distance
    const result: TrackPoint[] = [];
    let cumulativeDist = 0;

    for (let i = 0; i < rawPoints.length; i++) {
      const prev = rawPoints[(i - 1 + rawPoints.length) % rawPoints.length];
      const curr = rawPoints[i];
      const next = rawPoints[(i + 1) % rawPoints.length];

      // Tangent from finite differences
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const tangentAngle = Math.atan2(dy, dx);

      // Curvature from three consecutive points
      const curvature = this.computeCurvature(prev, curr, next);

      // Outward normal (perpendicular to tangent, pointing right)
const outwardX = Math.cos(tangentAngle - Math.PI / 2);
const outwardY = Math.sin(tangentAngle - Math.PI / 2);

      // Cumulative distance
      if (i > 0) {
        const segDx = curr.x - prev.x;
        const segDy = curr.y - prev.y;
        cumulativeDist += Math.sqrt(segDx * segDx + segDy * segDy);
      }

      result.push({
        x: curr.x,
        y: curr.y,
        tangentAngle,
        curvature,
        outwardX,
        outwardY,
        cumulativeDistance: cumulativeDist,
      });
    }

    return result;
  }

  // Catmull-Rom interpolation between p1 and p2
  private catmullRom(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    t: number
  ): { x: number; y: number } {
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x: 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      ),
      y: 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      ),
    };
  }

  // Menger curvature from three points
  private computeCurvature(
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number }
  ): number {
    const dxAB = b.x - a.x;
    const dyAB = b.y - a.y;
    const dxBC = c.x - b.x;
    const dyBC = c.y - b.y;

    const cross = dxAB * dyBC - dyAB * dxBC;
    const distAB = Math.sqrt(dxAB * dxAB + dyAB * dyAB);
    const distBC = Math.sqrt(dxBC * dxBC + dyBC * dyBC);
    const dxAC = c.x - a.x;
    const dyAC = c.y - a.y;
    const distAC = Math.sqrt(dxAC * dxAC + dyAC * dyAC);

    const denominator = distAB * distBC * distAC;
    if (denominator < 0.0001) return 0;

    return (2 * cross) / denominator;
  }

  private normalizeDistance(distance: number): number {
    if (this.totalLength === 0) return 0;
    let d = distance % this.totalLength;
    if (d < 0) d += this.totalLength;
    return d;
  }

  // Binary search for the segment containing the given distance
  private findSegmentIndex(distance: number): number {
    const points = this.points;
    if (points.length === 0) return 0;

    let lo = 0;
    let hi = points.length - 1;

    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (points[mid].cumulativeDistance <= distance) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    return lo;
  }
}