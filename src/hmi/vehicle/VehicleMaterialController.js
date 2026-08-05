import * as THREE from 'three/webgpu';

const TEXTURE_PROPERTIES = [
  'alphaMap',
  'aoMap',
  'bumpMap',
  'emissiveMap',
  'lightMap',
  'map',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
];

function upgradeGlassMaterial(source) {
  if (source.isMeshPhysicalMaterial) return source.clone();

  const material = new THREE.MeshPhysicalMaterial({
    color: source.color?.clone() ?? new THREE.Color(0xffffff),
    emissive: source.emissive?.clone() ?? new THREE.Color(0x000000),
    opacity: source.opacity,
    side: source.side,
    transparent: source.transparent,
    vertexColors: source.vertexColors,
  });
  material.name = source.name;
  TEXTURE_PROPERTIES.forEach((property) => {
    if (source[property]) material[property] = source[property];
  });
  if (source.normalScale) material.normalScale.copy(source.normalScale);
  return material;
}

function setTextureQuality(material) {
  TEXTURE_PROPERTIES.forEach((property) => {
    if (material[property]) material[property].anisotropy = 8;
  });
}

export class VehicleMaterialController {
  constructor(defaultPaint) {
    this.paintColor = new THREE.Color(defaultPaint);
    this.lightsEnabled = false;
    this.sceneMode = 'day';
    this.paintMaterials = new Set();
    this.rimMaterials = new Set();
    this.lightMaterials = new Set();
    this.glassMaterials = new Set();
  }

  configure(root) {
    const materialCache = new Map();

    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;

      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const sourceLabel = `${object.name} ${sourceMaterials.map((material) => material.name).join(' ')}`.toLowerCase();
      const isGlass = /glass|window/.test(sourceLabel);
      const materials = sourceMaterials.map((source) => {
        if (!materialCache.has(source.uuid)) {
          materialCache.set(source.uuid, isGlass ? upgradeGlassMaterial(source) : source.clone());
        }
        return materialCache.get(source.uuid);
      });
      object.material = Array.isArray(object.material) ? materials : materials[0];

      const label = `${object.name} ${materials.map((material) => material.name).join(' ')}`.toLowerCase();
      materials.forEach((material) => {
        setTextureQuality(material);
        material.envMapIntensity = material.envMapIntensity ?? 1;

        if (/carpaint|car paint|bodypaint/.test(label)) {
          this.configurePaint(material);
          this.paintMaterials.add(material);
        } else if (/rim_|rim |wheel/.test(label)) {
          this.configureRim(material);
          this.rimMaterials.add(material);
        } else if (/light max|headlight|lamp/.test(label)) {
          this.configureLight(material);
          this.lightMaterials.add(material);
        } else if (/glass|window/.test(label)) {
          this.configureGlass(material);
          this.glassMaterials.add(material);
        } else if (/carbon/.test(label)) {
          material.color?.setHex(0x07090b);
          material.metalness = 0.52;
          material.roughness = 0.21;
          material.envMapIntensity = 1.75;
          if ('clearcoat' in material) material.clearcoat = 0.72;
        } else if (/tire|kumho/.test(label)) {
          material.color?.setHex(0x090a0b);
          material.metalness = 0;
          material.roughness = 0.82;
          material.envMapIntensity = 0.34;
        } else if (/brakedisc|brake disc/.test(label)) {
          material.color?.setHex(0x6b7074);
          material.metalness = 0.94;
          material.roughness = 0.34;
          material.envMapIntensity = 1.4;
        } else if (/caliper/.test(label)) {
          material.color?.setHex(0xc48a28);
          material.metalness = 0.64;
          material.roughness = 0.24;
          material.envMapIntensity = 1.35;
        } else if (/badge|mirror/.test(label)) {
          material.metalness = Math.max(material.metalness ?? 0, 0.82);
          material.roughness = Math.min(material.roughness ?? 0.3, 0.18);
          material.envMapIntensity = 1.8;
        } else {
          material.envMapIntensity = Math.min(Math.max(material.envMapIntensity, 0.65), 1.4);
        }

        material.needsUpdate = true;
      });
    });

    this.setPaint(this.paintColor);
    this.setWheelStyle('multispoke');
    this.setLights(false);
    this.setSceneMode('day');
  }

  configurePaint(material) {
    material.color?.copy(this.paintColor);
    material.metalness = 0.78;
    material.roughness = 0.16;
    material.envMapIntensity = 2.05;
    if ('clearcoat' in material) material.clearcoat = 1;
    if ('clearcoatRoughness' in material) material.clearcoatRoughness = 0.045;
    if ('specularIntensity' in material) material.specularIntensity = 1;
    if ('iridescence' in material) material.iridescence = 0.035;
    if ('iridescenceIOR' in material) material.iridescenceIOR = 1.22;
  }

  configureRim(material) {
    material.color?.setHex(0x50565c);
    material.metalness = 0.96;
    material.roughness = 0.17;
    material.envMapIntensity = 1.85;
  }

  configureLight(material) {
    material.color?.setHex(0xe6f3f7);
    material.metalness = 0.06;
    material.roughness = 0.12;
    material.envMapIntensity = 1.8;
  }

  configureGlass(material) {
    material.color?.setHex(0x8da1ac);
    material.metalness = 0;
    material.roughness = 0.055;
    material.envMapIntensity = 2.1;
    material.ior = 1.48;
    material.transmission = 0.16;
    material.thickness = 0.025;
    material.opacity = 0.32;
    material.transparent = true;
    material.depthWrite = false;
    material.side = THREE.DoubleSide;
  }

  setPaint(color) {
    this.paintColor.set(color);
    this.paintMaterials.forEach((material) => {
      material.color?.copy(this.paintColor);
      material.needsUpdate = true;
    });
  }

  setWheelStyle(style) {
    const night = style === 'night';
    this.rimMaterials.forEach((material) => {
      material.color?.setHex(night ? 0x08090b : 0x50565c);
      material.roughness = night ? 0.23 : 0.17;
      material.envMapIntensity = night ? 1.45 : 1.85;
      material.needsUpdate = true;
    });
  }

  setLights(enabled) {
    this.lightsEnabled = enabled;
    this.applyLightState();
  }

  applyLightState() {
    const intensity = { day: 3.2, neon: 4.6, stage: 3.9 }[this.sceneMode] ?? 3.2;
    this.lightMaterials.forEach((material) => {
      material.emissive?.setHex(this.lightsEnabled ? 0xffffff : 0x060708);
      material.emissiveIntensity = this.lightsEnabled ? intensity : 0.06;
      material.needsUpdate = true;
    });
  }

  setSceneMode(mode) {
    this.sceneMode = mode;
    const paintIntensity = { day: 2.05, neon: 2.5, stage: 2.28 }[mode] ?? 2.05;
    const glassIntensity = { day: 2.1, neon: 2.55, stage: 2.35 }[mode] ?? 2.1;
    this.paintMaterials.forEach((material) => { material.envMapIntensity = paintIntensity; });
    this.glassMaterials.forEach((material) => { material.envMapIntensity = glassIntensity; });
    this.applyLightState();
  }
}
