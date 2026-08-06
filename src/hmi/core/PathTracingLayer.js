const CAMERA_SETTLE_MS = 170;
const INVALIDATION_PRIORITY = { camera: 0, materials: 1, scene: 2 };
const PATH_TRACING_PIXEL_RATIO_LIMIT = 1.35;

function getCameraSignature(camera) {
  return [
    ...camera.matrixWorld.elements,
    ...camera.projectionMatrix.elements,
  ].join(',');
}

function isSupportedMaterial(material) {
  return Boolean(material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial);
}

export class PathTracingLayer {
  constructor(container, scene, camera, options = {}) {
    this.container = container;
    this.scene = scene;
    this.camera = camera;
    this.exposure = options.exposure ?? 1;
    this.onStatus = options.onStatus;
    this.active = false;
    this.ready = false;
    this.building = false;
    this.disposed = false;
    this.cameraDirty = false;
    this.cameraSignature = '';
    this.pendingKind = null;
    this.settleAt = 0;
    this.operation = 0;
  }

  get isPresenting() {
    return this.active && this.ready && this.canvas?.classList.contains('is-visible');
  }

  get freezeScene() {
    return this.active
      && this.ready
      && (this.building || this.pendingKind !== 'scene');
  }

  async setEnabled(enabled) {
    this.active = Boolean(enabled);
    if (!this.active) {
      this.hide();
      this.onStatus?.('idle');
      return false;
    }

    this.onStatus?.('building');
    try {
      await this.ensureInitialized();
      if (!this.active || this.disposed) return false;
      this.pathTracer.updateCamera();
      this.cameraSignature = getCameraSignature(this.camera);
      this.show();
      this.onStatus?.('ready');
      return true;
    } catch (error) {
      this.active = false;
      this.hide();
      this.onStatus?.('error', error);
      throw error;
    }
  }

  async ensureInitialized() {
    if (!this.initialization) this.initialization = this.initialize();
    return this.initialization;
  }

  async initialize() {
    const operation = ++this.operation;
    const [THREE, pathTracingModule, areaLightModule] = await Promise.all([
      import('three'),
      import('three-gpu-pathtracer'),
      import('three/addons/lights/RectAreaLightUniformsLib.js'),
    ]);
    if (this.disposed || operation !== this.operation) return;

    areaLightModule.RectAreaLightUniformsLib.init();
    this.renderer = new THREE.WebGLRenderer({
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = this.exposure;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, PATH_TRACING_PIXEL_RATIO_LIMIT));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
    this.renderer.domElement.className = 'path-tracing-canvas';
    this.renderer.domElement.dataset.rendererBackend = 'webgl2-path-tracing';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this.pathTracer = new pathTracingModule.WebGLPathTracer(this.renderer);
    this.pathTracer.bounces = 4;
    this.pathTracer.transmissiveBounces = 6;
    this.pathTracer.filterGlossyFactor = 0.45;
    this.pathTracer.tiles.set(2, 2);
    this.pathTracer.renderScale = window.innerWidth < 760 ? 0.48 : 0.62;
    this.pathTracer.renderDelay = 60;
    this.pathTracer.minSamples = 1;
    this.pathTracer.fadeDuration = 260;
    this.pathTracer.dynamicLowRes = true;
    this.pathTracer.lowResScale = 0.2;
    this.pathTracer.textureSize.set(1024, 1024);

    await this.rebuildScene();
    if (this.disposed || operation !== this.operation) return;
    this.ready = true;
    this.cameraSignature = getCameraSignature(this.camera);
  }

  invalidate(kind = 'scene', delay = kind === 'scene' ? 950 : 120) {
    if (!this.active || !this.ready) return;
    const currentPriority = INVALIDATION_PRIORITY[this.pendingKind] ?? -1;
    if ((INVALIDATION_PRIORITY[kind] ?? 0) >= currentPriority) this.pendingKind = kind;
    this.settleAt = performance.now() + delay;
    this.hide();
  }

  setExposure(exposure) {
    this.exposure = exposure;
    if (this.renderer) this.renderer.toneMappingExposure = exposure;
  }

  resize(width, height) {
    if (!this.renderer) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, PATH_TRACING_PIXEL_RATIO_LIMIT));
    this.renderer.setSize(width, height, false);
    this.pathTracer?.reset();
  }

  update() {
    if (!this.active || !this.ready || this.building || this.disposed) return;
    const now = performance.now();
    const signature = getCameraSignature(this.camera);
    if (signature !== this.cameraSignature) {
      this.cameraSignature = signature;
      this.cameraDirty = true;
      this.cameraSettleAt = now + CAMERA_SETTLE_MS;
      this.hide();
    }

    if (this.pendingKind && now >= this.settleAt) {
      this.applyPendingUpdate();
      return;
    }

    if (this.cameraDirty) {
      if (now < this.cameraSettleAt || this.pendingKind) return;
      this.pathTracer.updateCamera();
      this.cameraDirty = false;
      this.show();
    }

    try {
      this.pathTracer.renderSample();
    } catch (error) {
      this.active = false;
      this.hide();
      this.onStatus?.('error', error);
      console.error('Path tracing render failed.', error);
    }
  }

  async applyPendingUpdate() {
    if (this.building || !this.pendingKind) return;
    const kind = this.pendingKind;
    this.pendingKind = null;
    this.building = true;
    try {
      if (kind === 'scene') {
        await this.rebuildScene();
      } else {
        this.pathTracer.updateMaterials();
        this.pathTracer.updateLights();
        this.pathTracer.updateEnvironment();
      }
      this.cameraSignature = getCameraSignature(this.camera);
      this.cameraDirty = false;
      if (this.active) this.show();
    } catch (error) {
      this.active = false;
      this.hide();
      this.onStatus?.('error', error);
      console.error('Path tracing scene update failed.', error);
    } finally {
      this.building = false;
    }
  }

  async rebuildScene() {
    const hidden = [];
    this.scene.traverseVisible((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (object.isInstancedMesh || materials.some((material) => !isSupportedMaterial(material))) {
        hidden.push(object);
        object.visible = false;
      }
    });

    try {
      this.pathTracer.setScene(this.scene, this.camera);
    } finally {
      hidden.forEach((object) => { object.visible = true; });
    }
  }

  show() {
    if (this.active && this.ready) this.canvas?.classList.add('is-visible');
  }

  hide() {
    this.canvas?.classList.remove('is-visible');
  }

  dispose() {
    this.disposed = true;
    this.active = false;
    this.operation += 1;
    this.pathTracer?.dispose();
    this.renderer?.dispose();
    this.canvas?.remove();
  }
}
