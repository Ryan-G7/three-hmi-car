import * as THREE from 'three/webgpu';

const LIGHT_PROFILES = {
  day: { front: 32, tail: 4.5 },
  neon: { front: 46, tail: 8 },
  stage: { front: 40, tail: 6.5 },
};

export class VehicleLighting {
  constructor(parent) {
    this.mode = 'day';
    this.enabled = false;
    this.root = new THREE.Group();
    this.root.name = 'Vehicle light sources';
    parent.add(this.root);
    this.buildLightSources();
    this.applyProfile();
  }

  buildLightSources() {
    this.frontLights = [-1, 1].map((side) => {
      const light = new THREE.SpotLight(0xe6f8ff, 0, 19, Math.PI * 0.105, 0.78, 1.7);
      light.position.set(side * 0.67, 0.54, 2.18);
      light.target.position.set(side * 1.2, -0.05, 9.2);
      this.root.add(light, light.target);
      return light;
    });

    this.tailLights = [-1, 1].map((side) => {
      const light = new THREE.PointLight(0xff2438, 0, 3.8, 2);
      light.position.set(side * 0.62, 0.64, -2.16);
      this.root.add(light);
      return light;
    });
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.applyProfile();
  }

  setMode(mode) {
    this.mode = mode;
    this.applyProfile();
  }

  applyProfile() {
    const profile = LIGHT_PROFILES[this.mode] ?? LIGHT_PROFILES.day;
    this.frontLights.forEach((light) => { light.intensity = this.enabled ? profile.front : 0; });
    this.tailLights.forEach((light) => { light.intensity = this.enabled ? profile.tail : 0; });
  }

  update() {}
}
