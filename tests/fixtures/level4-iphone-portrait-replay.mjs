/* Numeric-only abstraction of the 2026-08-20 iPhone portrait recording.
   Values are transcribed from the visible in-app debug overlay; no media,
   landmarks, face information, device identifier, or recording path is stored. */
export const IPHONE_PORTRAIT_SOURCE = Object.freeze({
  displayWidth: 886,
  displayHeight: 1920,
  expectedCameraAspect: 9 / 16,
  orientation: 'portrait',
});

export const IPHONE_VISIBLE_DEBUG_TRACE = Object.freeze([
  { seconds: 1.60, angleDeg: 174.4, progress: 0.66 },
  { seconds: 1.90, angleDeg: 173.2, progress: 0.32 },
  { seconds: 2.20, angleDeg: 171.8, progress: 0.23 },
  { seconds: 2.50, angleDeg: 174.1, progress: 0.15 },
  { seconds: 3.00, angleDeg: 174.7, progress: 0.37 },
  { seconds: 3.50, angleDeg: 172.8, progress: 0.48 },
  { seconds: 4.00, angleDeg: 171.7, progress: 0.31 },
  { seconds: 4.50, angleDeg: 173.1, progress: 0.37 },
  { seconds: 5.00, angleDeg: 175.0, progress: 0.51 },
  { seconds: 5.50, angleDeg: 174.3, progress: 0.67 },
  { seconds: 6.00, angleDeg: 172.6, progress: 0.38 },
  { seconds: 6.50, angleDeg: 173.7, progress: 0.65 },
  { seconds: 7.00, angleDeg: 173.2, progress: 0.41 },
  { seconds: 7.50, angleDeg: 171.3, progress: 0.17 },
  { seconds: 8.00, angleDeg: 173.3, progress: 0.32 },
  { seconds: 8.50, angleDeg: 172.8, progress: 0.53 },
  { seconds: 9.00, angleDeg: 172.5, progress: 0.26 },
]);

export const IPHONE_VISIBLE_DEBUG_SUMMARY = Object.freeze({
  angleWeight: 0.72,
  radialWeight: 0,
  angleMinDeg: 171.3,
  angleMaxDeg: 175.0,
  rawFrameWasPaused: true,
});
