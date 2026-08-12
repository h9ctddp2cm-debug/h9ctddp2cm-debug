// Developer-only FTHUE Level 3 bilateral tabletop prototype.
// This module is isolated from the formal FTHUE Level 5–7 Pilot Study.

export const LEVEL3_STATES = Object.freeze({
  CALIBRATION: "STATE_CALIBRATION",
  MIDLINE_READY: "STATE_MIDLINE_READY",
  WIPING_LATERAL: "STATE_WIPING_LATERAL",
  RETURN_CENTER: "STATE_RETURN_CENTER",
});

const VALID_SIDES = new Set(["LEFT", "RIGHT"]);
const VALID_REACH_PROFILES = new Set(["SHORT", "STANDARD", "LONG"]);
const VALID_TOLERANCE_MODES = new Set(["NARROW", "STANDARD", "WIDE"]);

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function median(values) {
  if (!values.length) return Number.NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianAbsoluteDeviation(values, center = median(values)) {
  if (!values.length || !Number.isFinite(center)) return Number.NaN;
  return median(values.map((value) => Math.abs(value - center)));
}

function pointIsSafe(point) {
  if (!point) return false;
  if (![point.x, point.y, point.z].every(Number.isFinite)) return false;
  if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return false;
  if (Math.abs(point.z) > 5) return false;
  return Number.isFinite(point.visibility) && point.visibility >= 0.6;
}

function planarDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function spatialDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
}

function worldPointIsSafe(point) {
  return Boolean(point) && [point.x, point.y, point.z].every(Number.isFinite);
}

export class Level3BilateralSandbox {
  constructor(therapistConfig = {}) {
    const side = String(therapistConfig.affectedSide || "LEFT").toUpperCase();
    const reachProfile = String(therapistConfig.reachRangeProfile || "STANDARD").toUpperCase();
    const toleranceMode = String(therapistConfig.toleranceMode || "STANDARD").toUpperCase();

    this.affectedSide = VALID_SIDES.has(side) ? side : "LEFT";
    this.reachRangeProfile = VALID_REACH_PROFILES.has(reachProfile) ? reachProfile : "STANDARD";
    this.toleranceMode = VALID_TOLERANCE_MODES.has(toleranceMode) ? toleranceMode : "STANDARD";
    this.isFacingCameraMirrored = therapistConfig.isFacingCameraMirrored !== false;

    // This sign describes the actual coordinate pipeline, not merely CSS video mirroring.
    // It can be replaced by bindEmpiricalDirection() after a therapist-led movement check.
    this.patientLeftXSign = therapistConfig.patientLeftXSign === -1 ? -1 : 1;

    this.debounceTimeMs = 800;
    this.trackingStabilizeDelayMs = 2500;
    this.minCalibrationMs = 2000;
    this.maxCalibrationMs = 5000;
    this.minCalibrationFrames = 30;

    this.reset();
  }

  reset() {
    this.currentState = LEVEL3_STATES.CALIBRATION;
    this.targetDirection = this.affectedSide;

    this.calibrationStartedAt = null;
    this.calibrationSamples = {
      vcpX: [],
      vcpY: [],
      wristSeparation: [],
      shoulderWidth: [],
      shoulderCenterX: [],
      leftWristX: [],
      rightWristX: [],
    };

    this.calibrationVcpXMedian = 0.5;
    this.calibrationVcpYMedian = 0.7;
    this.calibrationVcpMad = null;
    this.dynamicVcpTolerance = 0.05;
    this.baselineShoulderWidth = 0.25;
    this.baselineWristSeparation = 0.05;
    this.baselineLeftWristX = 0.475;
    this.baselineRightWristX = 0.525;
    this.calibrationShoulderCenter = 0.5;
    this.scaledTargetRangeX = 0.16;

    this.timerStartedAt = null;
    this.trackingNeedsRecovery = false;
    this.trackingRecoveredAt = null;
    this.isTrackingStable = true;

    this.isObjectVisible = false;
    this.returnTriggeredByRelease = false;
    this.score = 0;
    this.lastMetrics = null;
    this.lastMessage = "患手由健手輕輕承托，雙手放在同一張毛巾上；毛巾跟手側滑，軀幹保持正中，手指不需互扣";
    this.lastAction = "RESET";
  }

  configure({ affectedSide, reachRangeProfile, toleranceMode } = {}) {
    const side = String(affectedSide || this.affectedSide).toUpperCase();
    const reach = String(reachRangeProfile || this.reachRangeProfile).toUpperCase();
    const tolerance = String(toleranceMode || this.toleranceMode).toUpperCase();
    if (VALID_SIDES.has(side)) this.affectedSide = side;
    if (VALID_REACH_PROFILES.has(reach)) this.reachRangeProfile = reach;
    if (VALID_TOLERANCE_MODES.has(tolerance)) this.toleranceMode = tolerance;
    this.reset();
  }

  bindEmpiricalDirection(physicalDirection, observedDeltaX) {
    const direction = String(physicalDirection || "").toUpperCase();
    if (!VALID_SIDES.has(direction) || !Number.isFinite(observedDeltaX) || Math.abs(observedDeltaX) < 0.02) {
      return false;
    }
    const observedSign = Math.sign(observedDeltaX);
    this.patientLeftXSign = direction === "LEFT" ? observedSign : -observedSign;
    return true;
  }

  directionSign(direction = this.targetDirection) {
    return direction === "LEFT" ? this.patientLeftXSign : -this.patientLeftXSign;
  }

  resetTimer() {
    this.timerStartedAt = null;
  }

  abortCurrentRepetition() {
    this.currentState = LEVEL3_STATES.MIDLINE_READY;
    this.returnTriggeredByRelease = false;
    this.isObjectVisible = true;
    this.resetTimer();
  }

  startDebounce(nowMs) {
    if (this.timerStartedAt === null) {
      this.timerStartedAt = nowMs;
      return false;
    }
    return nowMs - this.timerStartedAt >= this.debounceTimeMs;
  }

  clearCalibration() {
    this.calibrationStartedAt = null;
    Object.values(this.calibrationSamples).forEach((values) => values.splice(0));
  }

  output({ message = this.lastMessage, action = "NONE", nowMs = 0, metrics = this.lastMetrics } = {}) {
    this.lastMessage = message;
    this.lastAction = action;
    this.lastMetrics = metrics;
    return {
      state: this.currentState,
      message,
      action,
      timestampMs: nowMs,
      targetDirection: this.targetDirection,
      targetRangeX: this.scaledTargetRangeX,
      centerTolerance: this.dynamicVcpTolerance,
      objectVisible: this.isObjectVisible,
      score: this.score,
      trackingStable: this.isTrackingStable,
      metrics,
    };
  }

  failTracking(message, action, nowMs) {
    this.resetTimer();
    this.trackingNeedsRecovery = true;
    this.trackingRecoveredAt = null;
    this.isTrackingStable = false;
    if (this.currentState === LEVEL3_STATES.CALIBRATION) this.clearCalibration();
    return this.output({ message, action, nowMs });
  }

  calculateScaledTargetRange() {
    const profileMultiplier = {
      SHORT: 0.6,
      STANDARD: 1,
      LONG: 1.4,
    }[this.reachRangeProfile];
    const anatomicalRange = this.baselineShoulderWidth * 0.8 * profileMultiplier;
    const direction = this.directionSign();
    const availableRange = direction > 0
      ? 0.95 - this.calibrationVcpXMedian
      : this.calibrationVcpXMedian - 0.05;
    return clamp(anatomicalRange, 0.06, Math.max(0.06, Math.min(0.32, availableRange)));
  }

  getDiagnosticThresholds() {
    return {
      trunkTranslationLimit: clamp(this.baselineShoulderWidth * 0.32, 0.045, 0.09),
      shoulderWidthChangeLimit: Math.max(0.04, this.baselineShoulderWidth * 0.25),
      wristClosedThreshold: this.baselineWristSeparation * 1.4,
      wristOpenThreshold: this.baselineWristSeparation * 2,
      wristSeparationLimit: this.baselineWristSeparation * 2,
      pairedWristAsymmetryLimit: Math.max(0.03, this.baselineShoulderWidth * 0.18),
    };
  }

  update(
    poseLandmarks,
    poseWorldLandmarks,
    trackingLost = false,
    nowMs = globalThis.performance?.now?.() ?? Date.now(),
  ) {
    if (trackingLost || !Array.isArray(poseLandmarks) || !Array.isArray(poseWorldLandmarks)) {
      return this.failTracking("請將雙手移回鏡頭範圍", "TRACKING_LOST", nowMs);
    }

    const leftShoulder = poseLandmarks[11];
    const rightShoulder = poseLandmarks[12];
    const leftWrist = poseLandmarks[15];
    const rightWrist = poseLandmarks[16];
    if (![leftShoulder, rightShoulder, leftWrist, rightWrist].every(pointIsSafe)) {
      return this.failTracking("訊號微弱或不穩定，請調整姿勢", "UNKNOWN", nowMs);
    }

    const vcpX = (leftWrist.x + rightWrist.x) / 2;
    const vcpY = (leftWrist.y + rightWrist.y) / 2;
    const worldLeftWrist = poseWorldLandmarks[15];
    const worldRightWrist = poseWorldLandmarks[16];
    if (![worldLeftWrist, worldRightWrist].every(worldPointIsSafe)) {
      return this.failTracking("手腕世界座標不完整，請調整雙手位置", "UNKNOWN", nowMs);
    }
    const wristSeparation = spatialDistance(worldLeftWrist, worldRightWrist);
    const shoulderWidth = planarDistance(leftShoulder, rightShoulder);
    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
    const metrics = {
      vcpX,
      vcpY,
      wristSeparation,
      wristSeparationUnit: "m",
      shoulderWidth,
      shoulderCenterX,
      leftWristX: leftWrist.x,
      rightWristX: rightWrist.x,
    };

    if (this.trackingNeedsRecovery) {
      this.trackingRecoveredAt = nowMs;
      this.trackingNeedsRecovery = false;
    }
    if (!this.isTrackingStable) {
      if (nowMs - this.trackingRecoveredAt < this.trackingStabilizeDelayMs) {
        this.resetTimer();
        return this.output({
          message: "正在重新建立追蹤，請保持雙手及坐姿穩定",
          action: "STABILIZING",
          nowMs,
          metrics,
        });
      }
      this.isTrackingStable = true;
      this.resetTimer();
    }

    if (this.currentState === LEVEL3_STATES.CALIBRATION) {
      if (this.calibrationStartedAt === null) {
        this.calibrationStartedAt = nowMs;
        Object.values(this.calibrationSamples).forEach((values) => values.splice(0));
      }

      this.calibrationSamples.vcpX.push(vcpX);
      this.calibrationSamples.vcpY.push(vcpY);
      this.calibrationSamples.wristSeparation.push(wristSeparation);
      this.calibrationSamples.shoulderWidth.push(shoulderWidth);
      this.calibrationSamples.shoulderCenterX.push(shoulderCenterX);
      this.calibrationSamples.leftWristX.push(leftWrist.x);
      this.calibrationSamples.rightWristX.push(rightWrist.x);

      const elapsed = nowMs - this.calibrationStartedAt;
      const enoughEvidence = elapsed >= this.minCalibrationMs
        && this.calibrationSamples.vcpX.length >= this.minCalibrationFrames;

      if (enoughEvidence) {
        const vcpMedian = median(this.calibrationSamples.vcpX);
        const vcpMad = medianAbsoluteDeviation(this.calibrationSamples.vcpX, vcpMedian);
        const shoulderCenterMedian = median(this.calibrationSamples.shoulderCenterX);
        const shoulderCenterMad = medianAbsoluteDeviation(
          this.calibrationSamples.shoulderCenterX,
          shoulderCenterMedian,
        );

        // Continue sampling until the five-second ceiling if the person is still repositioning.
        if (vcpMad <= 0.035 && shoulderCenterMad <= 0.03) {
          this.calibrationVcpXMedian = vcpMedian;
          this.calibrationVcpYMedian = median(this.calibrationSamples.vcpY);
          this.calibrationVcpMad = vcpMad;
          this.baselineWristSeparation = median(this.calibrationSamples.wristSeparation);
          this.baselineShoulderWidth = median(this.calibrationSamples.shoulderWidth);
          this.calibrationShoulderCenter = shoulderCenterMedian;
          this.baselineLeftWristX = median(this.calibrationSamples.leftWristX);
          this.baselineRightWristX = median(this.calibrationSamples.rightWristX);

          const toleranceMultiplier = {
            NARROW: 2,
            STANDARD: 3,
            WIDE: 4,
          }[this.toleranceMode];
          this.dynamicVcpTolerance = clamp((vcpMad || 0.01) * toleranceMultiplier, 0.025, 0.08);
          this.scaledTargetRangeX = this.calculateScaledTargetRange();

          this.currentState = LEVEL3_STATES.MIDLINE_READY;
          this.isObjectVisible = true;
          this.resetTimer();
          return this.output({
            message: "中央基準校準成功；患手繼續由健手輕輕承托，不需用力",
            action: "CALIBRATION_SUCCESS",
            nowMs,
            metrics,
          });
        }
      }

      if (elapsed >= this.maxCalibrationMs) {
        this.clearCalibration();
        return this.output({
          message: "校準失敗：請保持坐姿穩定、患手放鬆由健手承托後重試",
          action: "CALIBRATION_FAILED",
          nowMs,
          metrics,
        });
      }
      return this.output({
        message: `正在讀取中央桌面基準（${Math.min(this.calibrationSamples.vcpX.length, this.minCalibrationFrames)}/${this.minCalibrationFrames}）`,
        action: "CALIBRATING",
        nowMs,
        metrics,
      });
    }

    // These are movement-quality indicators only. They pause progression but do not diagnose compensation.
    const {
      trunkTranslationLimit,
      shoulderWidthChangeLimit,
      wristClosedThreshold,
      wristOpenThreshold,
      pairedWristAsymmetryLimit,
    } = this.getDiagnosticThresholds();

    if (Math.abs(shoulderCenterX - this.calibrationShoulderCenter) > trunkTranslationLimit
      || Math.abs(shoulderWidth - this.baselineShoulderWidth) > shoulderWidthChangeLimit) {
      this.resetTimer();
      return this.output({
        message: "軀幹位置改變，請由治療師確認坐姿後繼續",
        action: "TRUNK_TRANSLATION_WARNING",
        nowMs,
        metrics,
      });
    }

    const leftWristDisplacement = leftWrist.x - this.baselineLeftWristX;
    const rightWristDisplacement = rightWrist.x - this.baselineRightWristX;
    if (Math.abs(leftWristDisplacement - rightWristDisplacement) > pairedWristAsymmetryLimit) {
      this.resetTimer();
      return this.output({
        message: "雙手同步位移改變，請重新放好雙手並由治療師確認",
        action: "BILATERAL_ASYMMETRY_WARNING",
        nowMs,
        metrics,
      });
    }

    const handAction = wristSeparation <= wristClosedThreshold
      ? "CLOSED"
      : wristSeparation >= wristOpenThreshold
        ? "OPEN"
        : "TRANSITION";
    metrics.handAction = handAction;

    const isAtCenter = Math.abs(vcpX - this.calibrationVcpXMedian) <= this.dynamicVcpTolerance;
    const directedDisplacement = (vcpX - this.calibrationVcpXMedian) * this.directionSign();
    const targetReached = directedDisplacement >= this.scaledTargetRangeX;

    switch (this.currentState) {
      case LEVEL3_STATES.MIDLINE_READY: {
        this.isObjectVisible = true;
        if (isAtCenter && handAction === "CLOSED") {
          if (this.startDebounce(nowMs)) {
            this.currentState = LEVEL3_STATES.WIPING_LATERAL;
            this.resetTimer();
            return this.output({
              message: `雙手就位，請慢慢向${this.targetDirection === "LEFT" ? "左" : "右"}滑動`,
              action: "CENTER_READY",
              nowMs,
              metrics,
            });
          }
        } else {
          this.resetTimer();
        }
        return this.output({
          message: handAction === "CLOSED"
            ? "雙手一起輕輕放在中央起點，肩膊放鬆"
            : "請先把患手重新輕輕放好，由健手承托",
          action: "WAITING_AT_CENTER",
          nowMs,
          metrics,
        });
      }

      case LEVEL3_STATES.WIPING_LATERAL: {
        if (handAction === "OPEN") {
          this.isObjectVisible = false;
          this.returnTriggeredByRelease = true;
          this.currentState = LEVEL3_STATES.RETURN_CENTER;
          this.resetTimer();
          return this.output({
            message: "雙手已鬆開，請慢慢移回中央原點",
            action: "OBJECT_FADE_OUT",
            nowMs,
            metrics,
          });
        }
        if (handAction === "TRANSITION") {
          this.resetTimer();
          return this.output({
            message: "雙手快要分開，請重新把雙手輕輕靠攏後繼續",
            action: "HAND_TRANSITION",
            nowMs,
            metrics,
          });
        }
        if (targetReached) {
          if (this.startDebounce(nowMs)) {
            this.returnTriggeredByRelease = false;
            this.currentState = LEVEL3_STATES.RETURN_CENTER;
            this.resetTimer();
            return this.output({
              message: "已到達側方目標，雙手保持輕輕靠攏，慢慢滑回中央",
              action: "TARGET_REACHED",
              nowMs,
              metrics,
            });
          }
        } else {
          this.resetTimer();
        }
        return this.output({
          message: `請慢慢向${this.targetDirection === "LEFT" ? "左" : "右"}滑動`,
          action: "WIPING_LATERAL",
          nowMs,
          metrics,
        });
      }

      case LEVEL3_STATES.RETURN_CENTER: {
        if (isAtCenter) {
          if (this.startDebounce(nowMs)) {
            if (this.returnTriggeredByRelease) {
              this.returnTriggeredByRelease = false;
              this.isObjectVisible = true;
              this.currentState = LEVEL3_STATES.MIDLINE_READY;
              this.resetTimer();
              return this.output({
                message: "已安全回到中央，休息一下，準備好再開始",
                action: "RETURN_AFTER_RELEASE",
                nowMs,
                metrics,
              });
            }
            this.score += 1;
            this.targetDirection = this.targetDirection === "LEFT" ? "RIGHT" : "LEFT";
            this.scaledTargetRangeX = this.calculateScaledTargetRange();
            this.currentState = LEVEL3_STATES.MIDLINE_READY;
            this.resetTimer();
            return this.output({
              message: "已安全回到中央，下一次將改為另一方向",
              action: "SUCCESS_SCORE",
              nowMs,
              metrics,
            });
          }
        } else {
          this.resetTimer();
        }
        return this.output({
          message: "請控制雙手同步，慢慢返回中央起點",
          action: "RETURNING_CENTER",
          nowMs,
          metrics,
        });
      }

      default:
        this.reset();
        return this.output({
          message: "狀態已安全重置",
          action: "SAFE_RESET",
          nowMs,
          metrics,
        });
    }
  }
}
