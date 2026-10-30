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

  public reset(): void {
    this.filterLeftShoulder.reset();
    this.filterRightShoulder.reset();
    this.filterLeftHip.reset();
    this.filterRightHip.reset();
    this.filterNose.reset();
    this.isInitialized = false;
  }

  private toScreen(pt: Point3D, width: number, height: number): THREE.Vector3 {
    // MediaPipe normalized coordinates:
    // x in [0, 1] (left to right in unmirrored frame)
    // y in [0, 1] (top to bottom)
    // z relative depth (negative = closer to camera)
    const sx = pt.x * width;
    const sy = (1.0 - pt.y) * height; // Invert Y because Three.js +Y is UP
    const sz = -pt.z * width * 0.75;  // Negative pt.z maps to positive Three.js Z (closer to camera)
    return new THREE.Vector3(sx, sy, sz);
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
    // 0: nose
    // 11: left_shoulder, 12: right_shoulder
    // 23: left_hip, 24: right_hip
    const rawNose = landmarks[0];
    const rawLS = landmarks[11];
    const rawRS = landmarks[12];
    const rawLH = landmarks[23];
    const rawRH = landmarks[24];

    const minVis = 0.45;
    if (
      !rawLS || !rawRS ||
      (rawLS.visibility ?? 1) < minVis ||
      (rawRS.visibility ?? 1) < minVis
    ) {
      model.group.visible = false;
      return false;
    }

    // 1. OneEuroFilter Smoothing
    const sLS = this.filterLeftShoulder.filter(rawLS.x, rawLS.y, rawLS.z, timestamp);
    const sRS = this.filterRightShoulder.filter(rawRS.x, rawRS.y, rawRS.z, timestamp);
    const sNose = rawNose
      ? this.filterNose.filter(rawNose.x, rawNose.y, rawNose.z, timestamp)
      : null;

    const hasHips =
      rawLH &&
      rawRH &&
      (rawLH.visibility ?? 0) >= minVis &&
      (rawRH.visibility ?? 0) >= minVis;

    const sLH = hasHips
      ? this.filterLeftHip.filter(rawLH.x, rawLH.y, rawLH.z, timestamp)
      : null;
    const sRH = hasHips
      ? this.filterRightHip.filter(rawRH.x, rawRH.y, rawRH.z, timestamp)
      : null;

    // 2. Convert to Screen-Space
    this.vLS.copy(this.toScreen(sLS, width, height));
    this.vRS.copy(this.toScreen(sRS, width, height));
    if (sNose) this.vNose.copy(this.toScreen(sNose, width, height));
    if (sLH) this.vLH.copy(this.toScreen(sLH, width, height));
    if (sRH) this.vRH.copy(this.toScreen(sRH, width, height));

    // 3. Compute Midpoints
    this.vMidShoulder.addVectors(this.vLS, this.vRS).multiplyScalar(0.5);
    if (hasHips) {
      this.vMidHip.addVectors(this.vLH, this.vRH).multiplyScalar(0.5);
    }

    // 4. Biomechanical Scale Computation
    const measuredShoulderDist = this.vLS.distanceTo(this.vRS);
    if (measuredShoulderDist < 10) {
      model.group.visible = false;
      return false;
    }

    const scaleX = measuredShoulderDist / model.shoulderDistance;
    let scaleY = scaleX;

    if (hasHips) {
      const measuredTorsoHeight = this.vMidShoulder.distanceTo(this.vMidHip);
      scaleY = (measuredTorsoHeight * 1.15) / model.torsoHeight;
    } else {
      // Seated fallback: natural anatomical ratio (torso ~1.05-1.10x shoulder breadth)
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
    const yaw = Math.asin(Math.max(-0.85, Math.min(0.85, dz)));

    // Pitch: Torso forward/backward lean
    let pitch = 0.05; // slight natural chest slope
    if (hasHips) {
      const spineDY = this.vMidShoulder.y - this.vMidHip.y;
      const spineDZ = this.vMidShoulder.z - this.vMidHip.z;
      pitch = Math.atan2(spineDZ, Math.max(spineDY, 1.0));
      pitch = Math.max(-0.35, Math.min(0.40, pitch)); // clamp to natural range
    }

    this.targetEuler.set(pitch, yaw, roll, "YXZ");
    this.targetQuaternion.setFromEuler(this.targetEuler);

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

    model.group.visible = true;
    return true;
  }
}
