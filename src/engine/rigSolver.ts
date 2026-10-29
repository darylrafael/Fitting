import * as THREE from "three";
import { Landmark } from "../types/pose";
import { OneEuroFilter3D, Point3D } from "../utils/oneEuroFilter";
import { TShirtRig } from "./tshirtArchetype";

export class RigSolver {
  private filterLeftShoulder = new OneEuroFilter3D(1.2, 0.007);
  private filterRightShoulder = new OneEuroFilter3D(1.2, 0.007);
  private filterLeftElbow = new OneEuroFilter3D(1.2, 0.007);
  private filterRightElbow = new OneEuroFilter3D(1.2, 0.007);
  private filterLeftHip = new OneEuroFilter3D(1.2, 0.007);
  private filterRightHip = new OneEuroFilter3D(1.2, 0.007);

  // Temporary calculation vectors to prevent garbage collection allocations in hot render loop
  private vLS = new THREE.Vector3();
  private vRS = new THREE.Vector3();
  private vLE = new THREE.Vector3();
  private vRE = new THREE.Vector3();
  private vLH = new THREE.Vector3();
  private vRH = new THREE.Vector3();
  private vMidShoulder = new THREE.Vector3();
  private vMidHip = new THREE.Vector3();
  private vCenter = new THREE.Vector3();
  private vSpineDir = new THREE.Vector3();
  private vShoulderDir = new THREE.Vector3();
  private vArmDir = new THREE.Vector3();
  private qRot = new THREE.Quaternion();

  private toWorld(
    pt: Point3D,
    aspect: number,
    planeHeight = 2.309
  ): THREE.Vector3 {
    const planeWidth = planeHeight * aspect;
    // Map normalized [0, 1] to Three.js centered space [-half, +half]
    // Video is mirrored (-scale-x-100), so x is flipped accordingly
    const wx = (0.5 - pt.x) * planeWidth;
    const wy = (0.5 - pt.y) * planeHeight;
    const wz = -pt.z * 1.5; // depth estimation
    return new THREE.Vector3(wx, wy, wz);
  }

  update(
    rig: TShirtRig,
    landmarks: Landmark[] | null,
    aspect: number,
    timestamp: number
  ): boolean {
    if (!landmarks || landmarks.length < 25) {
      rig.mesh.visible = false;
      return false;
    }

    // Key MediaPipe upper body landmarks
    const rawLS = landmarks[11];
    const rawRS = landmarks[12];
    const rawLE = landmarks[13];
    const rawRE = landmarks[14];
    const rawLH = landmarks[23];
    const rawRH = landmarks[24];

    // Check visibility confidence
    const minVis = 0.45;
    if (
      (rawLS.visibility ?? 1) < minVis ||
      (rawRS.visibility ?? 1) < minVis
    ) {
      rig.mesh.visible = false;
      return false;
    }

    // 1. OneEuroFilter Landmark Smoothing
    const sLS = this.filterLeftShoulder.filter(rawLS.x, rawLS.y, rawLS.z, timestamp);
    const sRS = this.filterRightShoulder.filter(rawRS.x, rawRS.y, rawRS.z, timestamp);
    const sLE = this.filterLeftElbow.filter(rawLE.x, rawLE.y, rawLE.z, timestamp);
    const sRE = this.filterRightElbow.filter(rawRE.x, rawRE.y, rawRE.z, timestamp);
    const sLH = this.filterLeftHip.filter(rawLH.x, rawLH.y, rawLH.z, timestamp);
    const sRH = this.filterRightHip.filter(rawRH.x, rawRH.y, rawRH.z, timestamp);

    // 2. Convert to 3D World Space
    this.vLS.copy(this.toWorld(sLS, aspect));
    this.vRS.copy(this.toWorld(sRS, aspect));
    this.vLE.copy(this.toWorld(sLE, aspect));
    this.vRE.copy(this.toWorld(sRE, aspect));
    this.vLH.copy(this.toWorld(sLH, aspect));
    this.vRH.copy(this.toWorld(sRH, aspect));

    // 3. Compute Geometric Reference Centers
    this.vMidShoulder.addVectors(this.vLS, this.vRS).multiplyScalar(0.5);
    this.vMidHip.addVectors(this.vLH, this.vRH).multiplyScalar(0.5);
    this.vCenter.addVectors(this.vMidShoulder, this.vMidHip).multiplyScalar(0.5);

    // Position mesh at torso midpoint
    rig.mesh.position.set(this.vCenter.x, this.vCenter.y, this.vCenter.z);

    // 4. Metric Scale Factor (Shoulder Span)
    const currentShoulderSpan = this.vLS.distanceTo(this.vRS);
    // Archetype base mesh shoulder width is approx 0.44m
    const baseSpan = 0.44;
    const scaleFactor = Math.max(0.5, Math.min(2.5, currentShoulderSpan / baseSpan));
    rig.mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // 5. Torso Orientation (Yaw, Pitch, Roll)
    this.vShoulderDir.subVectors(this.vRS, this.vLS).normalize(); // Points left-to-right
    this.vSpineDir.subVectors(this.vMidShoulder, this.vMidHip).normalize(); // Points upwards

    // Compute normal facing vector (cross product of spine & shoulder)
    const vForward = new THREE.Vector3().crossVectors(this.vShoulderDir, this.vSpineDir).normalize();
    const rotMatrix = new THREE.Matrix4().makeBasis(
      this.vShoulderDir,
      this.vSpineDir,
      vForward
    );
    this.qRot.setFromRotationMatrix(rotMatrix);
    rig.mesh.quaternion.slerp(this.qRot, 0.4);

    // 6. Arm Bone Rotations
    // Left Upper Arm
    this.vArmDir.subVectors(this.vLE, this.vLS).normalize();
    const defaultLeftArmDir = new THREE.Vector3(0.7, -0.7, 0).normalize();
    const qLeftArm = new THREE.Quaternion().setFromUnitVectors(defaultLeftArmDir, this.vArmDir);
    rig.bones.leftUpperArm.quaternion.slerp(qLeftArm, 0.35);

    // Right Upper Arm
    this.vArmDir.subVectors(this.vRE, this.vRS).normalize();
    const defaultRightArmDir = new THREE.Vector3(-0.7, -0.7, 0).normalize();
    const qRightArm = new THREE.Quaternion().setFromUnitVectors(defaultRightArmDir, this.vArmDir);
    rig.bones.rightUpperArm.quaternion.slerp(qRightArm, 0.35);

    rig.mesh.visible = true;
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
