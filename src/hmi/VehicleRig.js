import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function createHotspotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 128, 128);
  context.beginPath();
  context.arc(64, 64, 43, 0, Math.PI * 2);
  context.fillStyle = 'rgba(12, 19, 25, .6)';
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = 'rgba(232, 242, 248, .94)';
  context.stroke();
  context.beginPath();
  context.arc(64, 64, 11, 0, Math.PI * 2);
  context.fillStyle = '#eef7fb';
  context.fill();
  return new THREE.CanvasTexture(canvas);
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 32, 3, 64, 32, 62);
  gradient.addColorStop(0, 'rgba(210, 240, 255, .56)');
  gradient.addColorStop(0.42, 'rgba(124, 191, 255, .18)');
  gradient.addColorStop(1, 'rgba(70, 127, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 64);
  return new THREE.CanvasTexture(canvas);
}

function createDoorShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0.03, 0.28);
  shape.lineTo(1.42, 0.25);
  shape.lineTo(1.55, 0.48);
  shape.lineTo(1.3, 0.98);
  shape.lineTo(0.18, 1.03);
  shape.lineTo(0.03, 0.83);
  shape.closePath();
  return shape;
}

export class VehicleRig {
  constructor(scene, onProgress) {
    this.scene = scene;
    this.onProgress = onProgress;
    this.group = new THREE.Group();
    this.displayGroup = new THREE.Group();
    this.group.add(this.displayGroup);
    this.scene.add(this.group);

    this.paintMeshes = [];
    this.rimMeshes = [];
    this.lightMeshes = [];
    this.accessPivots = [];
    this.hotspots = [];
    this.paintColor = new THREE.Color(0xaeb6bd);
    this.accessOpen = false;
    this.accessProgress = 0;
    this.lightsOn = true;
    this.sceneMode = 'day';
    this.autoRotate = false;
    this.hotspotsVisible = false;
  }

  async load() {
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    let gltf;
    try {
      gltf = await loader.loadAsync('/models/mercedes-benz_amg.glb', (event) => {
        const progress = event.total ? event.loaded / event.total : 0;
        this.onProgress?.(THREE.MathUtils.clamp(progress, 0, 0.96));
      });
    } finally {
      draco.dispose();
    }

    this.asset = gltf.scene;
    this.normaliseModel();
    this.configureMaterials();
    this.displayGroup.add(this.asset);
    this.buildAccessPieces();
    this.buildVehicleLights();
    this.buildHotspots();
    this.onProgress?.(1);
    return this;
  }

  normaliseModel() {
    const initialBounds = new THREE.Box3().setFromObject(this.asset);
    const initialSize = initialBounds.getSize(new THREE.Vector3());
    const scale = 4.9 / Math.max(initialSize.x, initialSize.z);
    this.asset.scale.setScalar(scale);
    this.asset.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(this.asset);
    const center = bounds.getCenter(new THREE.Vector3());
    this.asset.position.x -= center.x;
    this.asset.position.z -= center.z;
    this.asset.position.y -= bounds.min.y - 0.025;
    this.asset.updateMatrixWorld(true);
  }

  configureMaterials() {
    const materialCache = new Map();
    this.asset.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;

      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const materials = sourceMaterials.map((source) => {
        if (!materialCache.has(source.uuid)) materialCache.set(source.uuid, source.clone());
        return materialCache.get(source.uuid);
      });
      object.material = Array.isArray(object.material) ? materials : materials[0];

      const label = `${object.name} ${materials.map((material) => material.name).join(' ')}`.toLowerCase();
      if (label.includes('carpaint')) {
        materials.forEach((material) => {
          material.color.set(this.paintColor);
          material.metalness = 0.78;
          material.roughness = 0.19;
          material.clearcoat = 1;
          material.clearcoatRoughness = 0.07;
          material.envMapIntensity = 1.55;
        });
        this.paintMeshes.push(object);
      }
      if (label.includes('rim_') || label.includes('rim ')) this.rimMeshes.push(object);
      if (label.includes('light max')) this.lightMeshes.push(object);
      if (label.includes('window') || label.includes('glass')) {
        materials.forEach((material) => {
          material.side = THREE.DoubleSide;
          material.envMapIntensity = 1.2;
        });
      }

      materials.forEach((material) => {
        if (material.map) material.map.anisotropy = 8;
        if (material.normalMap) material.normalMap.anisotropy = 8;
      });
    });
  }

  buildAccessPieces() {
    const shape = createDoorShape();
    const doorGeometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      curveSegments: 32,
      depth: 0.045,
      steps: 1,
    });
    doorGeometry.computeVertexNormals();
    const doorMaskGeometry = new THREE.ShapeGeometry(shape, 32);

    this.doorMaterial = new THREE.MeshPhysicalMaterial({
      color: this.paintColor,
      emissive: this.paintColor.clone().multiplyScalar(0.12),
      emissiveIntensity: 0.75,
      metalness: 0.78,
      roughness: 0.27,
      clearcoat: 1,
      clearcoatRoughness: 0.07,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const holeMaterial = new THREE.MeshBasicMaterial({
      color: 0x07090b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });

    [-1, 1].forEach((side) => {
      const hole = new THREE.Mesh(doorMaskGeometry, holeMaterial.clone());
      hole.position.set(side * 1.055, 0, 0.43);
      hole.rotation.y = side * Math.PI / 2;
      hole.scale.x = side;
      hole.renderOrder = 4;
      this.displayGroup.add(hole);

      const pivot = new THREE.Group();
      pivot.position.set(side * 1.075, 0, 0.43);
      const panelAssembly = new THREE.Group();
      panelAssembly.rotation.y = side * Math.PI / 2;
      panelAssembly.scale.x = side;
      const panel = new THREE.Mesh(doorGeometry, this.doorMaterial.clone());
      panel.castShadow = true;
      const trim = new THREE.LineSegments(
        new THREE.EdgesGeometry(doorGeometry, 32),
        new THREE.LineBasicMaterial({ color: 0xdde8ec, transparent: true, opacity: 0 }),
      );
      const interiorMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x14181d,
        metalness: 0.18,
        opacity: 0,
        roughness: 0.62,
        side: THREE.DoubleSide,
        transparent: true,
      });
      const metalMaterial = new THREE.MeshStandardMaterial({
        color: 0xb6c0c7,
        metalness: 0.84,
        opacity: 0,
        roughness: 0.24,
        transparent: true,
      });
      const speakerMaterial = new THREE.MeshStandardMaterial({
        color: 0x242a30,
        metalness: 0.68,
        opacity: 0,
        roughness: 0.38,
        side: THREE.DoubleSide,
        transparent: true,
      });
      const detailParts = [];
      [-0.007, 0.052].forEach((depth) => {
        const inset = new THREE.Mesh(doorMaskGeometry, interiorMaterial.clone());
        inset.position.set(0.12, 0.13, depth);
        inset.scale.set(0.83, 0.74, 1);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.025), metalMaterial.clone());
        handle.position.set(0.35, 0.76, depth + (depth > 0 ? 0.012 : -0.012));
        handle.rotation.z = -0.06;
        const speaker = new THREE.Mesh(new THREE.CircleGeometry(0.14, 32), speakerMaterial.clone());
        speaker.position.set(1.13, 0.48, depth + (depth > 0 ? 0.014 : -0.014));
        if (depth < 0) speaker.rotation.y = Math.PI;
        detailParts.push(inset, handle, speaker);
        panelAssembly.add(inset, handle, speaker);
      });
      panelAssembly.add(panel, trim);
      pivot.add(panelAssembly);
      this.displayGroup.add(pivot);
      this.accessPivots.push({ detailParts, hole, panel, pivot, side, trim, type: 'door' });
    });

    const trunkMaterial = this.doorMaterial.clone();
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.07, 0.86), trunkMaterial);
    trunk.position.set(0, 0.12, -0.42);
    trunk.castShadow = true;
    const trunkPivot = new THREE.Group();
    trunkPivot.position.set(0, 0.66, -1.42);
    trunkPivot.add(trunk);
    this.displayGroup.add(trunkPivot);
    this.accessPivots.push({ panel: trunk, pivot: trunkPivot, side: 0, type: 'trunk' });
  }

  buildVehicleLights() {
    this.frontLights = [];
    [-0.62, 0.62].forEach((x) => {
      const headlight = new THREE.SpotLight(0xdff7ff, 42, 17, Math.PI * 0.13, 0.64, 1.4);
      headlight.position.set(x, 0.6, 2.15);
      headlight.target.position.set(x * 1.3, 0.02, 9);
      this.displayGroup.add(headlight, headlight.target);
      this.frontLights.push(headlight);
    });

    this.tailLights = [];
    [-0.7, 0.7].forEach((x) => {
      const tailLight = new THREE.PointLight(0xff1f2d, 12, 4.2, 2);
      tailLight.position.set(x, 0.56, -2.23);
      this.displayGroup.add(tailLight);
      this.tailLights.push(tailLight);
    });

    const underglowMaterial = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xb7d9ec,
      depthWrite: false,
      map: createGlowTexture(),
      opacity: 0.15,
      side: THREE.DoubleSide,
      transparent: true,
    });
    this.underglow = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 1.7), underglowMaterial);
    this.underglow.rotation.x = -Math.PI / 2;
    this.underglow.position.y = 0.035;
    this.displayGroup.add(this.underglow);
  }

  buildHotspots() {
    const texture = createHotspotTexture();
    const points = [
      { id: 'left-door', position: [-1.22, 0.84, -0.35] },
      { id: 'right-door', position: [1.22, 0.84, -0.35] },
      { id: 'trunk', position: [0, 0.72, -2.5] },
      { id: 'hood', position: [0, 0.72, 2.4] },
    ];
    points.forEach(({ id, position }) => {
      const material = new THREE.SpriteMaterial({
        depthTest: true,
        map: texture,
        sizeAttenuation: true,
        transparent: true,
      });
      const marker = new THREE.Sprite(material);
      marker.name = `hotspot-${id}`;
      marker.position.set(...position);
      marker.scale.setScalar(0.24);
      marker.visible = false;
      marker.userData.action = id;
      marker.renderOrder = 12;
      this.displayGroup.add(marker);
      this.hotspots.push(marker);
    });
  }

  setPaint(color) {
    this.paintColor.set(color);
    this.paintMeshes.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => material.color?.set(color));
    });
    this.accessPivots.forEach(({ panel }) => {
      panel.material.color?.set(color);
      panel.material.emissive?.set(color).multiplyScalar(0.12);
    });
  }

  setWheelStyle(style) {
    const color = style === 'night' ? 0x090a0c : 0x3d4248;
    const roughness = style === 'night' ? 0.24 : 0.16;
    this.rimMeshes.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        material.color?.setHex(color);
        material.metalness = 0.92;
        material.roughness = roughness;
      });
    });
  }

  setLights(enabled) {
    this.lightsOn = enabled;
    this.applyLightProfile();
    this.lightMeshes.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        material.emissive?.set(enabled ? 0xe5f7ff : 0x000000);
        material.emissiveIntensity = enabled ? 2.5 : 0;
      });
    });
  }

  setSceneMode(mode) {
    this.sceneMode = mode;
    this.applyLightProfile();
  }

  applyLightProfile() {
    const profiles = {
      day: { front: 30, tail: 7 },
      neon: { front: 24, tail: 8 },
      stage: { front: 13, tail: 4.5 },
    };
    const profile = profiles[this.sceneMode] ?? profiles.day;
    this.frontLights?.forEach((light) => { light.intensity = this.lightsOn ? profile.front : 0; });
    this.tailLights?.forEach((light) => { light.intensity = this.lightsOn ? profile.tail : 0; });
  }

  resetRotation() {
    this.group.rotation.y = 0;
  }

  setAccessOpen(open) {
    this.accessOpen = open;
  }

  setHotspots(visible) {
    this.hotspotsVisible = visible;
    this.hotspots.forEach((marker) => { marker.visible = visible; });
  }

  setAutoRotate(enabled) {
    this.autoRotate = enabled;
  }

  update(delta, elapsed) {
    const target = this.accessOpen ? 1 : 0;
    this.accessProgress = THREE.MathUtils.damp(this.accessProgress, target, 5.7, delta);
    this.accessPivots.forEach(({ detailParts, hole, panel, pivot, side, trim, type }) => {
      if (type === 'door') {
        pivot.rotation.y = -side * this.accessProgress * 0.82;
        hole.material.opacity = this.accessProgress * 0.86;
        panel.material.opacity = this.accessProgress * 0.94;
        trim.material.opacity = this.accessProgress * 0.56;
        detailParts.forEach((part) => { part.material.opacity = this.accessProgress * 0.96; });
      } else {
        pivot.rotation.x = -this.accessProgress * 0.98;
        panel.material.opacity = this.accessProgress;
      }
    });
    if (this.autoRotate) this.group.rotation.y += delta * 0.24;
    const glowOpacity = this.sceneMode === 'neon' ? 0.1 : this.sceneMode === 'stage' ? 0.045 : 0.055;
    this.underglow.material.opacity = (this.lightsOn ? glowOpacity : 0.01) + Math.sin(elapsed * 1.8) * 0.012;
    this.hotspots.forEach((marker, index) => {
      const pulse = 0.23 + Math.sin(elapsed * 2.2 + index) * 0.018;
      marker.scale.setScalar(pulse);
    });
  }
}
