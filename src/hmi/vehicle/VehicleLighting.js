import * as THREE from 'three/webgpu';

const LIGHT_PROFILES = {
  day: { front: 44, frontGlow: 0.09, frontLens: 4.8, tail: 7, tailLens: 4.5, underglow: 0.035 },
  neon: { front: 62, frontGlow: 0.16, frontLens: 7, tail: 14, tailLens: 6.5, underglow: 0.11 },
  stage: { front: 54, frontGlow: 0.14, frontLens: 6, tail: 12, tailLens: 5.8, underglow: 0.065 },
};

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 64, 4, 128, 64, 118);
  gradient.addColorStop(0, 'rgba(225, 248, 255, .88)');
  gradient.addColorStop(0.16, 'rgba(155, 218, 255, .46)');
  gradient.addColorStop(0.5, 'rgba(94, 164, 255, .14)');
  gradient.addColorStop(1, 'rgba(40, 95, 190, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return new THREE.CanvasTexture(canvas);
}

function createLensShape(width, height, swept = false) {
  const shape = new THREE.Shape();
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  shape.moveTo(-halfWidth, -halfHeight * 0.4);
  shape.quadraticCurveTo(-halfWidth * 0.75, halfHeight, 0, halfHeight * 0.82);
  shape.quadraticCurveTo(halfWidth * 0.78, halfHeight * (swept ? 0.1 : 0.7), halfWidth, -halfHeight);
  shape.quadraticCurveTo(0, -halfHeight * 0.55, -halfWidth, -halfHeight * 0.4);
  return shape;
}

export class VehicleLighting {
  constructor(parent) {
    this.mode = 'day';
    this.enabled = false;
    this.root = new THREE.Group();
    this.root.name = 'Vehicle lighting';
    parent.add(this.root);

    this.buildLenses();
    this.buildLightSources();
    this.buildUnderglow();
    this.applyProfile();
  }

  buildLenses() {
    const frontMaterial = new THREE.MeshStandardMaterial({
      color: 0xcbe5ed,
      emissive: 0xdff8ff,
      emissiveIntensity: 0,
      opacity: 0.08,
      roughness: 0.1,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const rearMaterial = new THREE.MeshStandardMaterial({
      color: 0x6d080d,
      emissive: 0xff172d,
      emissiveIntensity: 0,
      opacity: 0.2,
      roughness: 0.18,
      side: THREE.DoubleSide,
      transparent: true,
    });

    this.frontLenses = [];
    this.rearLenses = [];
    const frontGeometry = new THREE.ShapeGeometry(createLensShape(0.58, 0.15, true), 24);
    const rearGeometry = new THREE.ShapeGeometry(createLensShape(0.72, 0.105), 24);

    [-1, 1].forEach((side) => {
      const frontLens = new THREE.Mesh(frontGeometry, frontMaterial.clone());
      frontLens.position.set(side * 0.67, 0.62, 2.31);
      frontLens.rotation.z = side * -0.055;
      frontLens.renderOrder = 3;
      this.root.add(frontLens);
      this.frontLenses.push(frontLens);

      const rearLens = new THREE.Mesh(rearGeometry, rearMaterial.clone());
      rearLens.position.set(side * 0.67, 0.59, -2.31);
      rearLens.rotation.set(0, Math.PI, side * 0.035);
      rearLens.renderOrder = 3;
      this.root.add(rearLens);
      this.rearLenses.push(rearLens);
    });

    const glowTexture = createGlowTexture();
    this.glowTexture = glowTexture;
    this.frontGlows = [-1, 1].map((side) => {
      const material = new THREE.SpriteMaterial({
        blending: THREE.AdditiveBlending,
        color: 0xbfeaff,
        depthWrite: false,
        map: glowTexture,
        opacity: 0,
        transparent: true,
      });
      material.toneMapped = false;
      const sprite = new THREE.Sprite(material);
      sprite.position.set(side * 0.67, 0.62, 2.34);
      sprite.scale.set(0.92, 0.38, 1);
      this.root.add(sprite);
      return sprite;
    });
  }

  buildLightSources() {
    this.frontLights = [-1, 1].map((side) => {
      const light = new THREE.SpotLight(0xdff8ff, 0, 20, Math.PI * 0.12, 0.72, 1.65);
      light.position.set(side * 0.66, 0.59, 2.2);
      light.target.position.set(side * 1.45, -0.08, 9.5);
      this.root.add(light, light.target);
      return light;
    });

    this.tailLights = [-1, 1].map((side) => {
      const light = new THREE.PointLight(0xff1730, 0, 4.8, 2);
      light.position.set(side * 0.68, 0.58, -2.28);
      this.root.add(light);
      return light;
    });
  }

  buildUnderglow() {
    const material = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x9fd7ec,
      depthWrite: false,
      map: this.glowTexture,
      opacity: 0.01,
      side: THREE.DoubleSide,
      transparent: true,
    });
    material.toneMapped = false;
    this.underglow = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 1.75), material);
    this.underglow.rotation.x = -Math.PI / 2;
    this.underglow.position.y = 0.035;
    this.root.add(this.underglow);
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
    this.frontLenses.forEach((lens) => {
      lens.material.emissiveIntensity = this.enabled ? profile.frontLens : 0;
      lens.material.opacity = this.enabled ? 0.58 : 0.07;
    });
    this.rearLenses.forEach((lens) => {
      lens.material.emissiveIntensity = this.enabled ? profile.tailLens : 0;
      lens.material.opacity = this.enabled ? 0.62 : 0.17;
    });
    this.frontGlows.forEach((sprite) => {
      sprite.material.opacity = this.enabled ? profile.frontGlow : 0;
    });
    this.underglow.material.opacity = this.enabled ? profile.underglow : 0.008;
  }

  update(elapsed) {
    if (!this.enabled) return;
    const pulse = 0.96 + Math.sin(elapsed * 1.7) * 0.04;
    const profile = LIGHT_PROFILES[this.mode] ?? LIGHT_PROFILES.day;
    const baseOpacity = profile.frontGlow;
    this.frontGlows.forEach((sprite) => { sprite.material.opacity = baseOpacity * pulse; });
  }
}
