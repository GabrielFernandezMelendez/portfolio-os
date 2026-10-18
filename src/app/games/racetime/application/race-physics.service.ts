import { CarState, CarPhysicsConfig } from '../domain/car.model';
import { TrackGenerator } from './track-generator';

// Pure physics calculations — no DOM, no side effects.
// Receives state, returns new state.

const DEFAULT_PHYSICS: CarPhysicsConfig = {
  maxSpeed: 1000,
  acceleration: 400,
  deceleration: 50,
  steerSpeed: 2.0,
  centrifugalForceBase: 800,
  recoverySpeed: 2.5,
  frictionCurve: 0.12,
  wallSpeedPenalty: 0.85,
  gripStrength: 3.0,
};

export function createInitialCarState(): CarState {
  return {
    distance: 0,
    speed: 0,
    railPosition: 1,
    isAccelerating: false,
    isGlued: true,
    steerInput: 0,
    lapCount: 0,
  };
}

export function updatePhysics(
  car: CarState,
  track: TrackGenerator,
  dt: number,
  config: CarPhysicsConfig = DEFAULT_PHYSICS
): CarState {
  const safeDt = Math.min(dt, 0.1);
  if (safeDt <= 0) return car;

  const next = { ...car };
  const info = track.getTrackInfo(next.distance);

  updateSpeed(next, safeDt, config, info.isCurve, info.curvature);
  updateLateralPosition(next, safeDt, config, info);
  handleWallCollision(next, track, config);
  updateGluedState(next);
  updateDistance(next, safeDt, track, info);

  return next;
}

function updateSpeed(
  car: CarState,
  dt: number,
  config: CarPhysicsConfig,
  isCurve: boolean,
  curvature: number
): void {
  if (car.isAccelerating) {
    car.speed = Math.min(car.speed + config.acceleration * dt, config.maxSpeed);
  } else {
    car.speed = Math.max(car.speed - config.deceleration * dt, 0);
  }

  if (isCurve && car.speed > 10) {
    const radius = Math.abs(1 / curvature);
    const curveFriction = config.frictionCurve * (100 / Math.max(radius, 5)) * car.speed * dt;
    car.speed = Math.max(car.speed - curveFriction, 0);
  }
}

function updateLateralPosition(
  car: CarState,
  dt: number,
  config: CarPhysicsConfig,
  info: { isCurve: boolean; curvature: number }
): void {
  if (car.isAccelerating) {
    // Centrifugal force pushes outward on curves
    // If you accelerate on a curve, you drift outward and crash
if (info.isCurve && car.speed > 5) {
      const effectiveRadius = 1 / Math.abs(info.curvature);
      const cfMagnitude = (car.speed * car.speed) / Math.max(effectiveRadius, 5);
      const pushDirection = Math.sign(info.curvature);
      car.railPosition += pushDirection * (cfMagnitude / config.centrifugalForceBase) * dt;
    }

    // Player steering input (keyboard only)
    car.railPosition += car.steerInput * config.steerSpeed * dt;

    // Grip inversely proportional to speed
    // Fast = no grip = you fly off on curves
    // Slow = full grip = you stick to your lane
    const speedRatio = car.speed / config.maxSpeed;
    const effectiveGrip = config.gripStrength * (1 - speedRatio * speedRatio);

    const nearestRail = Math.round(car.railPosition);
    const gripDiff = nearestRail - car.railPosition;
    car.railPosition += gripDiff * Math.max(effectiveGrip, 0) * dt;

  } else {
    // Not accelerating: slide toward nearest rail
    // Recovery is faster at lower speeds
    const speedRatio = car.speed / config.maxSpeed;
    const recoveryMultiplier = 1 + (1 - speedRatio) * 2;

    const nearestRail = Math.max(0, Math.min(2, Math.round(car.railPosition)));
    const diff = nearestRail - car.railPosition;

    if (Math.abs(diff) > 0.01) {
      car.railPosition += Math.sign(diff) * Math.min(
        config.recoverySpeed * recoveryMultiplier * dt,
        Math.abs(diff)
      );
    }
  }
}

function handleWallCollision(
  car: CarState,
  track: TrackGenerator,
  config: CarPhysicsConfig
): void {
  const innerWall = track.getInnerWallRail();
  const outerWall = track.getOuterWallRail();

  if (car.railPosition < innerWall) {
    car.railPosition = innerWall;
    if (car.isAccelerating) car.speed *= config.wallSpeedPenalty;
  } else if (car.railPosition > outerWall) {
    car.railPosition = outerWall;
    if (car.isAccelerating) car.speed *= config.wallSpeedPenalty;
  }
}

function updateGluedState(car: CarState): void {
  if (car.isAccelerating) {
    car.isGlued = false;
    return;
  }

  const nearestRail = Math.max(0, Math.min(2, Math.round(car.railPosition)));
  const distToRail = Math.abs(car.railPosition - nearestRail);
  car.isGlued = distToRail < 0.15;
}

function updateDistance(
  car: CarState,
  dt: number,
  track: TrackGenerator,
  info: { curvature: number; isCurve: boolean }
): void {
  const railSpacing = 28;
  const railOffset = (car.railPosition - 1) * railSpacing;

  let distanceScale = 1;
  if (info.isCurve && info.curvature !== 0) {
    const baseRadius = Math.abs(1 / info.curvature);
    distanceScale = (baseRadius + railOffset) / baseRadius;
  }

  car.distance += car.speed * dt * distanceScale;

  const totalLength = track.getTotalLength();
  const newLap = Math.floor(car.distance / totalLength);
  if (newLap > car.lapCount) {
    car.lapCount = newLap;
  }

  if (car.distance > totalLength * 1000) {
    car.distance %= totalLength;
    car.lapCount = 0;
  }
}

export { DEFAULT_PHYSICS };