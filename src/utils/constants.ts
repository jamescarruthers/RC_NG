export const GRAVITY = 9.81;
export const PHYSICS_DT = 1 / 240;

export const VEHICLE = {
  mass: 1400,
  inertia: { xx: 600, yy: 2200, zz: 2400 },
  wheelbase: 2.7,
  trackWidth: 1.5,
  cgHeight: 0.45,
  length: 4.5,
  width: 1.8,
  height: 1.4,
};

export const SUSPENSION_DEFAULTS = {
  restLength: 0.35,
  maxTravel: 0.20,
  springRate: { front: 30000, rear: 35000 },
  dampingCompression: { front: 3000, rear: 3500 },
  dampingRebound: { front: 4500, rear: 5000 },
  antiRollRate: { front: 8000, rear: 6000 },
};

export const TIRE = {
  radius: 0.33,
  width: 0.22,
  peakMu: 1.0,
  pacejkaB: 10,
  pacejkaCLat: 1.9,
  pacejkaCLong: 1.65,
  pacejkaE: 0.97,
};

export const ENGINE = {
  peakTorque: 350,
  peakRPM: 4500,
  redline: 7000,
  idle: 800,
  gearRatios: [3.4, 2.5, 1.8, 1.3, 1.0, 0.8],
  finalDrive: 3.7,
  shiftUpRPM: 6500,
  shiftDownRPM: 2500,
};

export const WHEEL = {
  inertia: 1.5,
  brakeMaxTorque: 3000,
  brakeBias: 0.6,
};

export const AERO = {
  cd: 0.35,
  frontalArea: 2.2,
  airDensity: 1.225,
};

export const CAMERA = {
  distance: 6,
  height: 2.5,
  stiffness: 5.0,
  lookAtStiffness: 8.0,
};

// Suspension mount points in local space (origin at CG)
export const MOUNT_POINTS = {
  fl: { x: -0.75, y: -0.1, z: 1.35 },
  fr: { x: 0.75, y: -0.1, z: 1.35 },
  rl: { x: -0.75, y: -0.1, z: -1.35 },
  rr: { x: 0.75, y: -0.1, z: -1.35 },
};
