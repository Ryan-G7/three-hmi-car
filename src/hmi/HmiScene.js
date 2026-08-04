import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CAMERA_PRESETS = {
  hero: { position: [-7.4, 2.8, 8.2], target: [0, 0.65, 0] },
  front: { position: [-8.6, 1.9, 0.1], target: [-0.35, 0.62, 0] },
  side: { position: [0.2, 1.95, 9.2], target: [0, 0.62, 0] },
  rear: { position: [7.8, 2.35, -5.8], target: [0.3, 0.64, 0] },
};

const clampPixelRatio = () => Math.min(window.devicePixelRatio, 1.8);

function mesh(geometry, material, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function seededRandom(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export class HmiScene {
  constructor(container, onReady) {
    this.container = container;
    this.onReady = onReady;
    this.clock = new THREE.Clock();
    this.paintMeshes = [];
    this.vehicleLights = [];
    this.rimMeshes = [];
    this.doorPivots = [];
    this.doorProgress = 0;
    this.doorOpen = false;
    this.lightsOn = true;
    this.cameraGoal = null;
    this.pointer = new THREE.Vector2(2, 2);
    this.raycaster = new THREE.Raycaster();
    this.disposed = false;

    this.init();
  }

  async init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050607);
    this.scene.fog = new THREE.FogExp2(0x050607, 0.025);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 120);
    this.camera.position.fromArray(CAMERA_PRESETS.hero.position);

    this.renderer = new THREE.WebGPURenderer({
      antialias: true,
      alpha: false,
      forceWebGL: !navigator.gpu,
    });
    this.renderer.setPixelRatio(clampPixelRatio());
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    await this.renderer.init();
    if (this.disposed) return;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.minDistance = 5.2;
    this.controls.maxDistance = 18;
    this.controls.minPolarAngle = Math.PI * 0.24;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.fromArray(CAMERA_PRESETS.hero.target);
    this.controls.addEventListener('start', () => {
      this.cameraGoal = null;
    });

    this.buildStage();
    await this.buildCar();
    this.buildLighting();
    this.bindEvents();

    this.renderer.setAnimationLoop(() => this.render());
    this.onReady?.({ webgpu: Boolean(navigator.gpu) });
  }

  buildStage() {
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0c0d,
      metalness: 0.62,
      roughness: 0.5,
    });
    const floor = mesh(new THREE.PlaneGeometry(100, 100), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.castShadow = false;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(60, 60, 0x314044, 0x151d1f);
    grid.position.y = 0.006;
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    this.scene.add(grid);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x7ee0d3,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    });

    this.stageRings = new THREE.Group();
    [3.65, 4.35, 7.6].forEach((radius, index) => {
      const ring = mesh(new THREE.RingGeometry(radius, radius + 0.018, 160), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.018 + index * 0.002;
      this.stageRings.add(ring);
    });
    this.scene.add(this.stageRings);

    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0x6fdccc,
      transparent: true,
      opacity: 0.48,
    });
    const markerGeometry = new THREE.BoxGeometry(0.42, 0.014, 0.035);
    for (let i = 0; i < 32; i += 1) {
      const angle = (i / 32) * Math.PI * 2;
      const marker = mesh(markerGeometry, markerMaterial);
      marker.position.set(Math.cos(angle) * 6.45, 0.026, Math.sin(angle) * 6.45);
      marker.rotation.y = -angle;
      marker.castShadow = false;
      this.stageRings.add(marker);
    }

    const skyline = new THREE.Group();
    const towerMaterial = new THREE.MeshStandardMaterial({
      color: 0x101517,
      metalness: 0.35,
      roughness: 0.78,
    });
    const windowMaterial = new THREE.MeshBasicMaterial({
      color: 0x4c9e98,
      transparent: true,
      opacity: 0.25,
    });

    for (let i = 0; i < 28; i += 1) {
      const angle = (i / 28) * Math.PI * 2;
      const distance = 17 + seededRandom(i + 3) * 12;
      const height = 1.2 + seededRandom(i + 9) * 5;
      const width = 0.6 + seededRandom(i + 14) * 1.8;
      const tower = mesh(new THREE.BoxGeometry(width, height, width), towerMaterial);
      tower.position.set(Math.cos(angle) * distance, height / 2, Math.sin(angle) * distance);
      tower.castShadow = false;
      skyline.add(tower);

      if (i % 3 === 0) {
        const strip = mesh(new THREE.BoxGeometry(width * 0.6, height * 0.025, width + 0.01), windowMaterial);
        strip.position.set(tower.position.x, height * 0.72, tower.position.z);
        strip.castShadow = false;
        skyline.add(strip);
      }
    }
    this.scene.add(skyline);
  }

  async buildCar() {
    this.car = new THREE.Group();
    this.car.rotation.y = -0.08;
    this.scene.add(this.car);

    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');

    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    const [gltf, aoMap] = await Promise.all([
      loader.loadAsync('/models/nova-gt.glb'),
      new THREE.TextureLoader().loadAsync('/models/nova-gt-ao.png'),
    ]);
    draco.dispose();

    this.paintMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xa9afb2,
      metalness: 0.88,
      roughness: 0.24,
      clearcoat: 1,
      clearcoatRoughness: 0.055,
      aoMap,
    });
    const detailMaterial = new THREE.MeshStandardMaterial({
      color: 0x70797c,
      metalness: 1,
      roughness: 0.24,
    });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x6e888d,
      metalness: 0.2,
      roughness: 0.05,
      transmission: 0.72,
      thickness: 0.12,
      transparent: true,
      opacity: 0.96,
    });

    this.carAsset = gltf.scene.children[0];
    this.carAsset.scale.setScalar(1.28);
    this.carAsset.rotation.y = Math.PI / 2;
    this.car.add(this.carAsset);

    const body = this.carAsset.getObjectByName('body');
    const glass = this.carAsset.getObjectByName('glass');
    const trim = this.carAsset.getObjectByName('trim');
    body.material = this.paintMaterial;
    glass.material = glassMaterial;
    trim.material = detailMaterial;
    this.paintMeshes.push(body);

    ['rim_fl', 'rim_fr', 'rim_rl', 'rim_rr'].forEach((name) => {
      const rim = this.carAsset.getObjectByName(name);
      rim.material = detailMaterial;
      this.rimMeshes.push(rim);
    });

    this.carAsset.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });

    this.buildWelcomeProjection();
    this.buildVehicleLighting();

    const underglowMaterial = new THREE.MeshBasicMaterial({
      color: 0x5ed6c7,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.underglow = mesh(new THREE.PlaneGeometry(4.7, 2), underglowMaterial, [0, 0.025, 0]);
    this.underglow.rotation.x = -Math.PI / 2;
    this.underglow.castShadow = false;
    this.car.add(this.underglow);
  }

  buildWelcomeProjection() {
    [-1, 1].forEach((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.76, 0, side * 0.94);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        0, 0.43, 0,
        -1.45, 0.46, 0,
        -1.2, 1.22, 0,
        -0.1, 1.28, 0,
      ], 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      const material = new THREE.MeshBasicMaterial({
        color: 0x78ddcf,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        wireframe: true,
      });
      const projection = mesh(geometry, material);
      projection.castShadow = false;
      pivot.add(projection);
      this.car.add(pivot);
      this.doorPivots.push({ pivot, side, material });
    });
  }

  buildVehicleLighting() {
    [-0.54, 0.54].forEach((z) => {
      const headlight = new THREE.SpotLight(0xc9fff5, 18, 12, Math.PI * 0.16, 0.78, 1.5);
      headlight.position.set(-2.28, 0.57, z);
      headlight.target.position.set(-7, 0, z * 1.35);
      this.car.add(headlight, headlight.target);
      this.vehicleLights.push({ light: headlight, on: 18, off: 0 });
    });

    const tailGlow = new THREE.PointLight(0xff251d, 2.4, 3.2, 2);
    tailGlow.position.set(2.25, 0.66, 0);
    this.car.add(tailGlow);
    this.vehicleLights.push({ light: tailGlow, on: 2.4, off: 0 });
  }

  buildLighting() {
    const hemisphere = new THREE.HemisphereLight(0xc8e2df, 0x10100f, 1.8);
    this.scene.add(hemisphere);

    const key = new THREE.SpotLight(0xffffff, 75, 36, Math.PI * 0.2, 0.55, 1.2);
    key.position.set(5, 9, 7);
    key.target.position.set(0.5, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.00025;
    this.scene.add(key, key.target);

    const rim = new THREE.SpotLight(0x55cfc2, 42, 28, Math.PI * 0.24, 0.65, 1.4);
    rim.position.set(-6, 5, -7);
    rim.target.position.set(-0.7, 0.7, 0);
    this.scene.add(rim, rim.target);

    const warm = new THREE.SpotLight(0xffbb72, 30, 24, Math.PI * 0.2, 0.7, 1.5);
    warm.position.set(-3, 4, 8);
    warm.target.position.set(-1, 0.6, 0);
    this.scene.add(warm, warm.target);

    this.ambientLight = rim;
  }

  bindEvents() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerleave', this.handlePointerLeave);
  }

  handlePointerMove = (event) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  handlePointerLeave = () => {
    this.pointer.set(2, 2);
  };

  resize() {
    if (!this.renderer || !this.camera) return;
    const { clientWidth, clientHeight } = this.container;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(clampPixelRatio());
    this.renderer.setSize(clientWidth, clientHeight);
  }

  setPaint(color) {
    this.paintMaterial.color.set(color);
  }

  setDoors(open) {
    this.doorOpen = open;
  }

  setLights(on) {
    this.lightsOn = on;
    this.vehicleLights.forEach(({ light, on: onIntensity, off }) => {
      light.intensity = on ? onIntensity : off;
    });
    this.underglow.material.opacity = on ? 0.16 : 0.025;
  }

  setWheelStyle(style) {
    const color = style === 'sport' ? 0x252a2c : 0x879094;
    const roughness = style === 'sport' ? 0.3 : 0.2;
    this.rimMeshes.forEach((rim) => {
      rim.material.color.setHex(color);
      rim.material.roughness = roughness;
    });
  }

  setAmbience(color) {
    this.ambientLight.color.set(color);
    this.stageRings.children.forEach((object) => {
      if (object.material?.color) object.material.color.set(color);
    });
    this.underglow.material.color.set(color);
  }

  setMode(mode) {
    const exposure = mode === '赛道' ? 1.3 : mode === '运动' ? 1.22 : 1.15;
    this.renderer.toneMappingExposure = exposure;
  }

  setView(view) {
    const preset = CAMERA_PRESETS[view];
    if (!preset) return;
    this.cameraGoal = {
      position: new THREE.Vector3().fromArray(preset.position),
      target: new THREE.Vector3().fromArray(preset.target),
    };
  }

  updateCamera(delta) {
    if (!this.cameraGoal) return;
    const alpha = 1 - Math.exp(-delta * 4.5);
    this.camera.position.lerp(this.cameraGoal.position, alpha);
    this.controls.target.lerp(this.cameraGoal.target, alpha);

    if (this.camera.position.distanceTo(this.cameraGoal.position) < 0.025) {
      this.camera.position.copy(this.cameraGoal.position);
      this.controls.target.copy(this.cameraGoal.target);
      this.cameraGoal = null;
    }
  }

  updateDoors(delta) {
    const target = this.doorOpen ? 1 : 0;
    this.doorProgress = THREE.MathUtils.damp(this.doorProgress, target, 6, delta);
    this.doorPivots.forEach(({ pivot, side, material }) => {
      pivot.rotation.y = side * this.doorProgress * 0.92;
      material.opacity = this.doorProgress * 0.38;
    });
  }

  updateHover() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.paintMeshes, false).length > 0;
    this.renderer.domElement.style.cursor = hit ? 'grab' : 'default';
  }

  render() {
    if (this.disposed) return;
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    this.updateCamera(delta);
    this.updateDoors(delta);
    this.updateHover();
    this.controls.update();

    this.stageRings.rotation.y = elapsed * 0.018;
    this.underglow.material.opacity = (this.lightsOn ? 0.13 : 0.02) + Math.sin(elapsed * 2) * 0.018;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.renderer?.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer?.domElement.removeEventListener('pointerleave', this.handlePointerLeave);
    this.renderer?.setAnimationLoop(null);
    this.controls?.dispose();
    this.scene?.traverse((object) => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
