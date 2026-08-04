import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CAMERA_VIEWS } from './config.js';
import { EnvironmentRig } from './EnvironmentRig.js';
import { VehicleRig } from './VehicleRig.js';

const PIXEL_RATIO_LIMIT = 1.7;

function cameraPreset(id) {
  return CAMERA_VIEWS.find((view) => view.id === id) ?? CAMERA_VIEWS[0];
}

export class HmiScene {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.timer = new THREE.Timer();
    this.pointer = new THREE.Vector2(2, 2);
    this.raycaster = new THREE.Raycaster();
    this.cameraGoal = null;
    this.disposed = false;
    this.view = 'hero';
    this.sceneMode = 'day';

    this.init();
  }

  async init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb8c9d5);
    this.scene.fog = new THREE.FogExp2(0xb8c9d5, 0.008);

    const aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1);
    const initial = cameraPreset('hero');
    this.camera = new THREE.PerspectiveCamera(initial.fov, aspect, 0.08, 140);
    this.camera.position.fromArray(initial.position);

    this.renderer = new THREE.WebGLRenderer({
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_LIMIT));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.4;
    this.controls.maxDistance = 18;
    this.controls.minPolarAngle = Math.PI * 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.fromArray(initial.target);
    this.controls.addEventListener('start', () => { this.cameraGoal = null; });

    this.environment = new EnvironmentRig(this.scene);
    this.vehicle = new VehicleRig(this.scene, (progress) => this.callbacks.onProgress?.(progress));
    await this.vehicle.load();
    if (this.disposed) return;

    this.buildPostProcessing();
    this.bindEvents();
    this.renderer.setAnimationLoop(() => this.render());
    this.callbacks.onReady?.({ webgl: true });
  }

  buildPostProcessing() {
    const size = new THREE.Vector2(this.container.clientWidth, this.container.clientHeight);
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_LIMIT));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(size, 0.2, 0.7, 0.88);
    this.bloomPass.threshold = 0.83;
    this.bloomPass.strength = 0.22;
    this.bloomPass.radius = 0.64;
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  bindEvents() {
    this.handlePointerMove = (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    this.handlePointerLeave = () => {
      this.pointer.set(2, 2);
      this.renderer.domElement.style.cursor = 'grab';
    };
    this.handlePointerDown = () => {
      if (!this.vehicle.hotspotsVisible) return;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.vehicle.hotspots, false)[0];
      if (!hit) return;
      const open = !this.vehicle.accessOpen;
      this.vehicle.setAccessOpen(open);
      this.callbacks.onAccessChange?.(open, hit.object.userData.action);
    };

    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerleave', this.handlePointerLeave);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer?.setSize(width, height);
    if (this.controls) this.setView(this.view, true);
  }

  setPaint(color) {
    this.vehicle?.setPaint(color);
  }

  setWheelStyle(style) {
    this.vehicle?.setWheelStyle(style);
  }

  setLights(enabled) {
    this.vehicle?.setLights(enabled);
  }

  setAccessOpen(open) {
    this.vehicle?.setAccessOpen(open);
  }

  setHotspots(visible) {
    this.vehicle?.setHotspots(visible);
  }

  setAutoRotate(enabled) {
    this.vehicle?.setAutoRotate(enabled);
  }

  setWeather(weather) {
    this.environment?.setWeather(weather);
  }

  setSceneMode(mode) {
    const previousMode = this.sceneMode;
    this.sceneMode = mode;
    this.environment?.setMode(mode);
    this.vehicle?.setSceneMode(mode);
    if (previousMode === 'stage' && mode !== 'stage') this.vehicle?.resetRotation();
    if (this.bloomPass) {
      this.bloomPass.strength = mode === 'neon' ? 0.42 : mode === 'stage' ? 0.2 : 0.16;
      this.bloomPass.threshold = mode === 'neon' ? 0.7 : 0.86;
    }
    if (this.renderer) this.renderer.toneMappingExposure = mode === 'day' ? 0.92 : mode === 'stage' ? 1.04 : 1.12;
  }

  setTimeOfDay(value) {
    this.environment?.setTimeOfDay(value);
  }

  setSunAngle(value) {
    this.environment?.setSunAngle(value);
  }

  setPerspective(value) {
    const preset = cameraPreset(this.view);
    this.camera.fov = THREE.MathUtils.lerp(preset.fov - 7, preset.fov + 9, value);
    this.camera.updateProjectionMatrix();
  }

  setView(view, immediate = false) {
    const preset = cameraPreset(view);
    this.view = preset.id;
    const position = new THREE.Vector3().fromArray(preset.position);
    const target = new THREE.Vector3().fromArray(preset.target);
    if (this.camera.aspect < 0.78 && !['interior', 'wheel'].includes(preset.id)) {
      const portraitScale = 1 + (0.78 - this.camera.aspect) * 2.35;
      position.sub(target).multiplyScalar(portraitScale).add(target);
    }
    const goal = {
      fov: preset.fov,
      position,
      target,
    };
    if (immediate) {
      this.camera.position.copy(goal.position);
      this.controls.target.copy(goal.target);
      this.camera.fov = goal.fov;
      this.camera.updateProjectionMatrix();
      this.cameraGoal = null;
      return;
    }
    this.cameraGoal = goal;
  }

  updateCamera(delta) {
    if (!this.cameraGoal) return;
    const alpha = 1 - Math.exp(-delta * 4.2);
    this.camera.position.lerp(this.cameraGoal.position, alpha);
    this.controls.target.lerp(this.cameraGoal.target, alpha);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.cameraGoal.fov, alpha);
    this.camera.updateProjectionMatrix();

    if (this.camera.position.distanceTo(this.cameraGoal.position) < 0.02) {
      this.camera.position.copy(this.cameraGoal.position);
      this.controls.target.copy(this.cameraGoal.target);
      this.camera.fov = this.cameraGoal.fov;
      this.camera.updateProjectionMatrix();
      this.cameraGoal = null;
    }
  }

  updatePointer() {
    if (!this.vehicle?.hotspotsVisible) {
      this.renderer.domElement.style.cursor = 'grab';
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hovering = this.raycaster.intersectObjects(this.vehicle.hotspots, false).length > 0;
    this.renderer.domElement.style.cursor = hovering ? 'pointer' : 'grab';
  }

  render() {
    if (this.disposed || !this.composer) return;
    this.timer.update();
    const delta = Math.min(this.timer.getDelta(), 0.05);
    const elapsed = this.timer.getElapsed();
    this.updateCamera(delta);
    this.updatePointer();
    this.controls.update();
    this.environment.update(delta, elapsed);
    this.vehicle.update(delta, elapsed);
    this.composer.render(delta);
  }

  dispose() {
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.renderer?.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer?.domElement.removeEventListener('pointerleave', this.handlePointerLeave);
    this.renderer?.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer?.setAnimationLoop(null);
    this.controls?.dispose();
    this.environment?.dispose();
    this.scene?.traverse((object) => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
    this.composer?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
