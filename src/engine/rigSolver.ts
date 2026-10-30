import * as THREE from "three";
import { Landmark } from "../types/pose";
import { OneEuroFilter3D, Point3D } from "../utils/oneEuroFilter";
import { GarmentInstance } from "./garmentModel";

export class RigSolver {
  // OneEuroFilters for smooth, jitter-free joint tracking
  private filterLeftShoulder = new OneEuroFilter3D(1.2, 0.007);
  private filterRightShoulder = new OneEuroFilter3D(1.2, 0.007);
  private filterLeftHip = new OneEuroFilter3D(1.2, 0.007);
  private filterRightHip = new OneEuroFilter3D(1.2, 0.007);
  private filterNose = new OneEuroFilter3D(1.2, 0.007);

  // Cached Three.js vectors for GC-free 60 FPS loop
  private vLS = new THREE.Vector3();
  private vRS = new THREE.Vector3();
  private vLH = new THREE.Vector3();
  private vRH = new THREE.Vector3();
  private vNose = new THREE.Vector3();
  private vMidShoulder = new THREE.Vector3();
  private vMidHip = new THREE.Vector3();

  private targetScale = new THREE.Vector3();
  private targetEuler = new THREE.Euler(0, 0, 0, "YXZ");
  private targetQuaternion = new THREE.Quaternion();

  private isInitialized = false;
  private lostTrackingFrames = 0;
  private readonly maxLostTrackingFrames = 6;

  public reset(): void {
    this.filterLeftShoulder.reset();
    this.filterRightShoulder.reset();
    this.filterLeftHip.reset();
    this.filterRightHip.reset();
    this.filterNose.reset();
    this.isInitialized = false;
    this.lostTrackingFrames = 0;
  }

  private toScreen(
    pt: Point3D,
    width: number,
    height: number,
    target: THREE.Vector3
  ): void {
    // MediaPipe normalized coordinates:
    // x in [0, 1] (left to right in unmirrored frame)
    // y in [0, 1] (top to bottom)
    // z relative depth (negative = closer to camera)
    const sx = pt.x * width;
    const sy = (1.0 - pt.y) * height; // Invert Y because Three.js +Y is UP
    const sz = -pt.z * width * 0.75;  // Negative pt.z maps to positive Three.js Z (closer to camera)
    target.set(sx, sy, sz);
  }

  update(
    model: GarmentInstance,
    landmarks: Landmark[] | null,
    width: number,
    height: number,
    timestamp: number
  ): boolean {
    if (!landmarks || landmarks.length < 25) {
      model.group.visible = false;
      return false;
    }

    // MediaPipe landmarks:
    // 0: nose, 9: mouth_left, 10: mouth_right
    // 11: left_shoulder, 12: right_shoulder
    // 23: left_hip, 24: right_hip
    const rawNose = landmarks[0];
    const rawML = landmarks[9];
    const rawMR = landmarks[10];
    const rawLS = landmarks[11];
    const rawRS = landmarks[12];
    const rawLH = landmarks[23];
    const rawRH = landmarks[24];

    const minVis = 0.45;
    const isShoulderVisible =
      rawLS &&
      rawRS &&
      (rawLS.visibility ?? 1) >= minVis &&
      (rawRS.visibility ?? 1) >= minVis;

    if (!isShoulderVisible) {
      this.lostTrackingFrames++;
      if (this.lostTrackingFrames > this.maxLostTrackingFrames) {
        model.group.visible = false;
        return false;
      }
      // Sustain last stable pose across momentary tracking drops (< 100ms) to prevent flicker
      return true;
    }

    this.lostTrackingFrames = 0;

    // 1. OneEuroFilter Smoothing
    const sLS = this.filterLeftShoulder.filter(rawLS.x, rawLS.y, rawLS.z, timestamp);
    const sRS = this.filterRightShoulder.filter(rawRS.x, rawRS.y, rawRS.z, timestamp);
    const sNose = rawNose
      ? this.filterNose.filter(rawNose.x, rawNose.y, rawNose.z, timestamp)
      : null;

    const hasHips =
      rawLH &&
      rawRH &&
      rawLH.y < 0.85 &&
      rawRH.y < 0.85 &&
      (rawLH.visibility ?? 0) >= 0.65 &&
      (rawRH.visibility ?? 0) >= 0.65;

    const sLH = hasHips
      ? this.filterLeftHip.filter(rawLH.x, rawLH.y, rawLH.z, timestamp)
      : null;
    const sRH = hasHips
      ? this.filterRightHip.filter(rawRH.x, rawRH.y, rawRH.z, timestamp)
      : null;

    // 2. Convert to Screen-Space (in-place zero allocation)
    this.toScreen(sLS, width, height, this.vLS);
    this.toScreen(sRS, width, height, this.vRS);
    if (sNose) this.toScreen(sNose, width, height, this.vNose);
    if (sLH) this.toScreen(sLH, width, height, this.vLH);
    if (sRH) this.toScreen(sRH, width, height, this.vRH);

    const measuredShoulderDist = this.vLS.distanceTo(this.vRS);
    if (measuredShoulderDist < 10) {
      model.group.visible = false;
      return false;
    }

    // 3. Compute Midpoints & Anatomical Shoulder Crest Anchor
    this.vMidShoulder.addVectors(this.vLS, this.vRS).multiplyScalar(0.5);
    // Lift anchor by 8% of shoulder span to align shoulder crest with trapezius slope
    // (glenohumeral joints sit ~2cm below the acromion crest)
    this.vMidShoulder.y += measuredShoulderDist * 0.08;

    if (hasHips) {
      this.vMidHip.addVectors(this.vLH, this.vRH).multiplyScalar(0.5);
    }

    // 4. Biomechanical Scale Computation
    const scaleX = measuredShoulderDist / model.shoulderDistance;
    let scaleY = scaleX;

    if (hasHips) {
      const measuredTorsoHeight = this.vMidShoulder.distanceTo(this.vMidHip);
      scaleY = (measuredTorsoHeight * 1.15) / model.torsoHeight;
    } else {
      // Seated fallback: natural anatomical ratio (torso ~1.08x shoulder breadth)
      scaleY = scaleX * 1.08;
    }

    const scaleZ = (scaleX + scaleY) * 0.5;
    this.targetScale.set(scaleX, scaleY, scaleZ);

    // 5. Biomechanical Orientation (Euler 'YXZ' to prevent gimbal lock)
    // Roll: In-plane shoulder angle
    const dx = this.vLS.x - this.vRS.x;
    const dy = this.vLS.y - this.vRS.y;
    const roll = Math.atan2(dy, dx);

    // Yaw: Left-right depth disparity (Right Shoulder Z minus Left Shoulder Z)
    const dz = (this.vRS.z - this.vLS.z) / Math.max(measuredShoulderDist, 1.0);
    const yaw = Math.asin(Math.max(-0.75, Math.min(0.75, dz)));

    // Pitch: Torso forward/backward lean (naturally upright in front of screen)
    let pitch = 0.02; // slight natural chest posture (~1.1 deg)
    if (hasHips) {
      const spineDY = this.vMidShoulder.y - this.vMidHip.y;
      const spineDZ = this.vMidShoulder.z - this.vMidHip.z;
      pitch = Math.atan2(spineDZ, Math.max(spineDY, 1.0));
      pitch = Math.max(-0.08, Math.min(0.12, pitch)); // clamp to realistic upper body range
    }

    this.targetEuler.set(pitch, yaw, roll, "YXZ");
    this.targetQuaternion.setFromEuler(this.targetEuler);

    // 5b. Dynamic Jaw & Chin Clearance Guard:
    // Prevents collar rim from overlapping the user's chin, jawline, or mouth during head motion or shoulder tilt
    if (rawNose && (rawNose.visibility ?? 0) > minVis) {
      const noseY = (1.0 - rawNose.y) * height;
      let chinY = noseY - Math.max(35, measuredShoulderDist * 0.22);
      if (rawML && rawMR && (rawML.visibility ?? 0) > minVis && (rawMR.visibility ?? 0) > minVis) {
        const mouthY = (1.0 - (rawML.y + rawMR.y) * 0.5) * height;
        chinY = Math.min(chinY, mouthY - Math.max(16, measuredShoulderDist * 0.08));
      }

      // Collar top elevation accounting for shoulder tilt (roll)
      const collarTopY =
        this.vMidShoulder.y +
        scaleY * model.collarOffset +
        Math.abs(Math.sin(roll)) * (scaleX * 0.105);

      const minClearance = 8; // ensure at least 8px visual clearance below chin
      if (collarTopY > chinY - minClearance) {
        this.vMidShoulder.y -= (collarTopY - (chinY - minClearance));
      }
    }

    // 6. Smooth Apply
    if (!this.isInitialized) {
      model.group.position.copy(this.vMidShoulder);
      model.group.scale.copy(this.targetScale);
      model.group.quaternion.copy(this.targetQuaternion);
      this.isInitialized = true;
    } else {
      model.group.position.lerp(this.vMidShoulder, 0.45);
      model.group.scale.lerp(this.targetScale, 0.35);
      model.group.quaternion.slerp(this.targetQuaternion, 0.40);
    }

    model.group.updateMatrixWorld(true);
    model.group.visible = true;
    return true;
  }
}
