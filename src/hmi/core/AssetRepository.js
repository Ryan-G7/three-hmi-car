import * as THREE from 'three/webgpu';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const ASSET_WEIGHTS = {
  environment: 0.18,
  vehicle: 0.82,
};

export class AssetRepository {
  constructor(onProgress) {
    this.onProgress = onProgress;
    this.progress = { environment: 0, vehicle: 0 };
    this.cache = new Map();
  }

  report(key, value) {
    this.progress[key] = THREE.MathUtils.clamp(value, 0, 1);
    const total = Object.entries(ASSET_WEIGHTS).reduce(
      (sum, [name, weight]) => sum + this.progress[name] * weight,
      0,
    );
    this.onProgress?.(total);
  }

  loadDayEnvironment() {
    if (!this.cache.has('environment')) {
      const promise = new HDRLoader()
        .setDataType(THREE.HalfFloatType)
        .loadAsync('/environment/cayley_lookout_2k.hdr', (event) => {
          this.report('environment', event.total ? event.loaded / event.total : 0.3);
        })
        .then((texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          texture.colorSpace = THREE.LinearSRGBColorSpace;
          texture.name = 'Cayley Lookout HDR';
          this.environmentTexture = texture;
          this.report('environment', 1);
          return texture;
        });
      this.cache.set('environment', promise);
    }
    return this.cache.get('environment');
  }

  loadVehicle() {
    if (!this.cache.has('vehicle')) {
      this.cache.set('vehicle', this.loadVehicleAsset());
    }
    return this.cache.get('vehicle');
  }

  async loadVehicleAsset() {
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    const onProgress = (event) => {
      this.report('vehicle', event.total ? event.loaded / event.total : 0.24);
    };

    try {
      let gltf;
      try {
        gltf = await loader.loadAsync('/models/mercedes-benz_amg.glb', onProgress);
      } catch (error) {
        console.warn('Primary vehicle asset failed; using the compact fallback model.', error);
        gltf = await loader.loadAsync('/models/nova-gt.glb', onProgress);
      }
      this.report('vehicle', 1);
      return gltf;
    } finally {
      draco.dispose();
    }
  }

  dispose() {
    this.environmentTexture?.dispose();
    this.cache.clear();
  }
}
