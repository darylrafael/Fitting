import * as THREE from "three";
import { Landmark } from "../types/pose";
import { OneEuroFilter3D, Point3D } from "../utils/oneEuroFilter";
import { TShirtArchetypeModel } from "./tshirtArchetype";

export class RigSolver {
  private filterLeftShoulder = new OneEuroFilter3D(1.2, 0.007);
  private filterRightShoulder = new OneEuroFilter3D(1.2, 0.007);
  private filterLeftElbow = new OneEuroFilter3D(1.2, 0.007);
  private filterRightElbow = new OneEuroFilter3D(1.2, 0.007);
  private filterLeftHip = new OneEuroFilter3D(1.2, 0.007);
  private filterRightHip = new OneEuroFilter3D(1.2, 0.007);

  // Cached calculation vectors to avoid per-frame GC allocations
  private vLS = new THREE.Vector3();
  private vRS = new THREE.Vector3();
  private vLE = new THREE.Vector3();
  private vRE = new THREE.Vector3();
  private vLH = new THREE.Vector3();
  private vRH = new THREE.Vector3();

  private vMidShoulder = new THREE.Vector3();
  private vMidHip = new THREE.Vector3();
  private vShoulderDir = new THREE.Vector3();
  private vSpineDir = new THREE.Vector3();
  private vForward = new THREE.Vector3();

  private rotMatrix = new THREE.Matrix4();
  private qTorso = new THREE.Quaternion();
  private qTorsoInv = new THREE.Quaternion();

  private vArmWorld = new THREE.Vector3();
  private vArmLocal = new THREE.Vector3();
  private vDown = new THREE.Vector3(0, -1, 0);
  private qSleeve = new THREE.Quaternion();

  private toScreen(pt: Point3D, width: number, height: number): THREE.Vector3 {
    // MediaPipe normalized coordinates:
    // x in [0, 1] (left to right)
    // y in [0, 1] (top to bottom)
    // z roughly relative depth
    const sx = pt.x * width;
    const sy = (1.0 - pt.y) * height; // Invert Y because Three.js +Y is UP
    const sz = -pt.z * width * 0.75;  // Depth scaled to pixel units
    return new THREE.Vector3(sx, sy, sz);
  }

  update(
    model: TShirtArchetypeModel,
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
    // 11: left_shoulder, 12: right_shoulder
    // 13: left_elbow, 14: right_elbow
    // 23: left_hip, 24: right_hip
    const rawLS = landmarks[11];
    const rawRS = landmarks[12];
    const rawLE = landmarks[13];
    const rawRE = landmarks[14];
    const rawLH = landmarks[23];
    const rawRH = landmarks[24];

    const minVis = 0.45;
    if (
      (rawLS.visibility ?? 1) < minVis ||
      (rawRS.visibility ?? 1) < minVis
    ) {
      model.group.visible = false;
      return false;
    }

    // 1. OneEuroFilter Landmark Smoothing
    const sLS = this.filterLeftShoulder.filter(rawLS.x, rawLS.y, rawLS.z, timestamp);
    const sRS = this.filterRightShoulder.filter(rawRS.x, rawRS.y, rawRS.z, timestamp);
    const sLE = this.filterLeftElbow.filter(rawLE.x, rawLE.y, rawLE.z, timestamp);
    const sRE = this.filterRightElbow.filter(rawRE.x, rawRE.y, rawRE.z, timestamp);
    const sLH = this.filterLeftHip.filter(rawLH.x, rawLH.y, rawLH.z, timestamp);
    const sRH = this.filterRightHip.filter(rawRH.x, rawRH.y, rawRH.z, timestamp);

    // 2. Convert to Three.js Screen-Space Coordinates
    this.vLS.copy(this.toScreen(sLS, width, height));
    this.vRS.copy(this.toScreen(sRS, width, height));
    this.vLE.copy(this.toScreen(sLE, width, height));
    this.vRE.copy(this.toScreen(sRE, width, height));
    this.vLH.copy(this.toScreen(sLH, width, height));
    this.vRH.copy(this.toScreen(sRH, width, height));

    // 3. Compute Midpoints
    this.vMidShoulder.addVectors(this.vLS, this.vRS).multiplyScalar(0.5);
    this.vMidHip.addVectors(this.vLH, this.vRH).multiplyScalar(0.5);

    // 4. Position Garment Group at Mid-Shoulder
    model.group.position.lerp(this.vMidShoulder, 0.45);

    // 5. Scale Garment to User Body Proportions
    // Reference half-width W = 90 (full width = 180)
    // Reference height H = 220
    const measuredShoulderWidth = this.vLS.distanceTo(this.vRS);
    const measuredTorsoHeight = this.vMidShoulder.distanceTo(this.vMidHip);

    if (measuredShoulderWidth > 10 && measuredTorsoHeight > 10) {
      const targetScaleX = measuredShoulderWidth / 180;
      const targetScaleY = (measuredTorsoHeight * 1.18) / 220; // Extends slightly past belt line
      const targetScaleZ = (targetScaleX + targetScaleY) * 0.5;

      model.group.scale.set(
        THREE.MathUtils.lerp(model.group.scale.x, targetScaleX, 0.35),
        THREE.MathUtils.lerp(model.group.scale.y, targetScaleY, 0.35),
        THREE.MathUtils.lerp(model.group.scale.z, targetScaleZ, 0.35)
      );
    }

    // 6. Torso 3D Orientation (Yaw, Pitch, Roll)
    // Left-to-right vector along shoulders:
    this.vShoulderDir.subVectors(this.vRS, this.vLS).normalize();
    // Spine vector pointing up:
    this.vSpineDir.subVectors(this.vMidShoulder, this.vMidHip).normalize();
    // Forward normal perpendicular to chest:
    this.vForward.crossVectors(this.vShoulderDir, this.vSpineDir).normalize();

    // Orthonormal basis matrix:
    this.rotMatrix.makeBasis(this.vShoulderDir, this.vSpineDir, this.vForward);
    this.qTorso.setFromRotationMatrix(this.rotMatrix);
    model.group.quaternion.slerp(this.qTorso, 0.4);

    // 7. Dynamic Sleeve Articulation (in Local Group Space)
    this.qTorsoInv.copy(model.group.quaternion).invert();

    // Left Arm
    this.vArmWorld.subVectors(this.vLE, this.vLS).normalize();
    this.vArmLocal.copy(this.vArmWorld).applyQuaternion(this.qTorsoInv).normalize();
    this.qSleeve.setFromUnitVectors(this.vDown, this.vArmLocal);
    model.leftSleevePivot.quaternion.slerp(this.qSleeve, 0.4);

    // Right Arm
    this.vArmWorld.subVectors(this.vRE, this.vRS).normalize();
    this.vArmLocal.copy(this.vArmWorld).applyQuaternion(this.qTorsoInv).normalize();
    this.qSleeve.setFromUnitVectors(this.vDown, this.vArmLocal);
    model.rightSleevePivot.quaternion.slerp(this.qSleeve, 0.4);

    model.group.visible = true;
    return true;
  }

  reset() {
    this.filterLeftShoulder.reset();
    this.filterRightShoulder.reset();
    this.filterLeftElbow.reset();
    this.filterRightElbow.reset();
    this.filterLeftHip.reset();
    this.filterRightHip.reset();
  }
}
