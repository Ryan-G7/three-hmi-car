import * as THREE from 'three/webgpu';
import { VehicleAccessController } from './vehicle/VehicleAccessController.js';
import { VehicleHotspots } from './vehicle/VehicleHotspots.js';
import { VehicleLighting } from './vehicle/VehicleLighting.js';
import { VehicleMaterialController } from './vehicle/VehicleMaterialController.js';

const VEHICLE_LENGTH = 4.9;
const DEFAULT_PAINT = 0xaeb6bd;
const WHEEL_ASSEMBLY_PATTERN = /^(?:M_Rim_Main_Max(?:\.?\d+)?|M_Tire_Max_Kumho_Ecsta_V710_Small(?:\.?\d+)?|M_RimBadge_Max(?:\.?\d+)?|etk_brakedisc_[RF]_carbon(?:\.?\d+)?)$/;

export class VehicleRig {
  constructor(scene, assets) {
    this.assets = assets;
    this.group = new THREE.Group();
    this.displayGroup = new THREE.Group();
    this.group.add(this.displayGroup);
    scene.add(this.group);

    this.materials = new VehicleMaterialController(DEFAULT_PAINT);
    this.autoRotate = false;
    this.sceneMode = 'day';
    this.wheelAngle = 0;
    this.wheelPivots = [];
  }

  async load() {
    const gltf = await this.assets.loadVehicle();
    this.asset = gltf.scene;
    this.normaliseModel();
    this.materials.configure(this.asset);
    this.displayGroup.add(this.asset);

    this.access = new VehicleAccessController(this.asset);
    this.setupWheelAnimation();
    this.lighting = new VehicleLighting(this.displayGroup);
    this.hotspotController = new VehicleHotspots(this.displayGroup);
    return this;
  }

  normaliseModel() {
    const initialBounds = new THREE.Box3().setFromObject(this.asset);
    const initialSize = initialBounds.getSize(new THREE.Vector3());
    const scale = VEHICLE_LENGTH / Math.max(initialSize.x, initialSize.z);
    this.asset.scale.setScalar(scale);
    this.asset.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(this.asset);
    const center = bounds.getCenter(new THREE.Vector3());
    this.asset.position.x -= center.x;
    this.asset.position.z -= center.z;
    this.asset.position.y -= bounds.min.y - 0.025;
    this.asset.updateMatrixWorld(true);
  }

  setPaint(color) {
    this.materials.setPaint(color);
  }

  setWheelStyle(style) {
    this.materials.setWheelStyle(style);
  }

  setLights(enabled) {
    this.materials.setLights(enabled);
    this.lighting?.setEnabled(enabled);
  }

  setSceneMode(mode) {
    this.sceneMode = mode;
    this.materials.setSceneMode(mode);
    this.lighting?.setMode(mode);
    this.group.position.y = mode === 'stage' ? 0.47 : 0;
  }

  setAccessOpen(open) {
    this.access?.setOpen(open);
  }

  setAccessState(state) {
    this.access?.setState(state);
  }

  toggleAccess(part) {
    return this.access?.toggle(part) ?? null;
  }

  setHotspots(visible) {
    this.hotspotController?.setVisible(visible);
  }

  setAutoRotate(enabled) {
    this.autoRotate = enabled;
  }

  resetRotation() {
    this.group.rotation.y = 0;
  }

  setupWheelAnimation() {
    const assemblies = [];
    this.asset.updateMatrixWorld(true);
    this.asset.traverse((object) => {
      if (WHEEL_ASSEMBLY_PATTERN.test(object.name)) assemblies.push(object);
    });

    const wheelGroups = new Map();
    assemblies.forEach((object) => {
      const center = object.getWorldPosition(new THREE.Vector3());
      const key = `${center.x < 0 ? 'left' : 'right'}-${center.z < 0 ? 'rear' : 'front'}`;
      const group = wheelGroups.get(key) ?? [];
      group.push({ center, object });
      wheelGroups.set(key, group);
    });

    wheelGroups.forEach((entries, key) => {
      const worldCenter = entries.reduce(
        (sum, entry) => sum.add(entry.center),
        new THREE.Vector3(),
      ).multiplyScalar(1 / entries.length);
      const pivot = new THREE.Group();
      pivot.name = `Animated wheel ${key}`;
      pivot.position.copy(this.asset.worldToLocal(worldCenter.clone()));
      this.asset.add(pivot);
      pivot.updateMatrixWorld(true);
      entries.forEach(({ object }) => pivot.attach(object));
      this.wheelPivots.push(pivot);
    });
    this.asset.updateMatrixWorld(true);
  }

  hitTest(raycaster) {
    return this.hotspotController?.hitTest(raycaster) ?? null;
  }

  get hotspotsVisible() {
    return this.hotspotController?.visible ?? false;
  }

  update(delta, elapsed) {
    this.access?.update(delta);
    this.lighting?.update(elapsed);
    this.hotspotController?.update(elapsed);
    if (this.sceneMode === 'neon') {
      this.wheelAngle = THREE.MathUtils.euclideanModulo(this.wheelAngle - delta * 19, Math.PI * 2);
      this.wheelPivots.forEach((pivot) => { pivot.rotation.x = this.wheelAngle; });
    }
    if (this.autoRotate) this.group.rotation.y += delta * 0.24;
  }

  dispose() {
    this.hotspotController?.dispose();
  }
}
