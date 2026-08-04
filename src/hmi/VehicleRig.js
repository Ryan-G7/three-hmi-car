import * as THREE from 'three/webgpu';
import { VehicleAccessController } from './vehicle/VehicleAccessController.js';
import { VehicleHotspots } from './vehicle/VehicleHotspots.js';
import { VehicleLighting } from './vehicle/VehicleLighting.js';
import { VehicleMaterialController } from './vehicle/VehicleMaterialController.js';

const VEHICLE_LENGTH = 4.9;
const DEFAULT_PAINT = 0xaeb6bd;

export class VehicleRig {
  constructor(scene, assets) {
    this.assets = assets;
    this.group = new THREE.Group();
    this.displayGroup = new THREE.Group();
    this.group.add(this.displayGroup);
    scene.add(this.group);

    this.materials = new VehicleMaterialController(DEFAULT_PAINT);
    this.autoRotate = false;
  }

  async load() {
    const gltf = await this.assets.loadVehicle();
    this.asset = gltf.scene;
    this.normaliseModel();
    this.materials.configure(this.asset);
    this.displayGroup.add(this.asset);

    this.access = new VehicleAccessController(this.displayGroup, DEFAULT_PAINT);
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
    this.access?.setPaint(color);
  }

  setWheelStyle(style) {
    this.materials.setWheelStyle(style);
  }

  setLights(enabled) {
    this.materials.setLights(enabled);
    this.lighting?.setEnabled(enabled);
  }

  setSceneMode(mode) {
    this.lighting?.setMode(mode);
    this.group.position.y = mode === 'stage' ? 0.47 : 0;
  }

  setAccessOpen(open) {
    this.access?.setOpen(open);
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

  hitTest(raycaster) {
    return this.hotspotController?.hitTest(raycaster) ?? null;
  }

  get hotspotsVisible() {
    return this.hotspotController?.visible ?? false;
  }

  update(delta, elapsed) {
    this.access?.update(delta);
    this.hotspotController?.update(elapsed);
    if (this.autoRotate) this.group.rotation.y += delta * 0.24;
  }

  dispose() {
    this.hotspotController?.dispose();
  }
}
