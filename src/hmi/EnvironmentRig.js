import * as THREE from 'three/webgpu';
import { MODE_LIGHTING, WEATHER_PROFILES } from './environment/profiles.js';

const NIGHT_BACKGROUND = new THREE.Color(0x030509);

function seededRandom(seed) {
  const value = Math.sin(seed * 91.719) * 43758.5453;
  return value - Math.floor(value);
}

function surface(geometry, material, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

export class EnvironmentRig {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.mode = 'day';
    this.weather = 'sunny';
    this.timeOfDay = 0.78;
    this.neonStreaks = [];

    this.root = new THREE.Group();
    this.dayGroup = new THREE.Group();
    this.neonGroup = new THREE.Group();
    this.stageGroup = new THREE.Group();
    this.root.add(this.dayGroup, this.neonGroup, this.stageGroup);
    this.scene.add(this.root);

    this.buildLighting();
    this.buildGrounds();
    this.buildNeonDetails();
    this.buildStageDetails();
    this.buildSnow();
  }

  async load() {
    const [environment, architecture] = await Promise.all([
      this.assets.loadDayEnvironment(),
      this.assets.loadArchitecture(),
    ]);
    this.environmentTexture = environment;
    this.addArchitecture(architecture.scene);
    this.scene.environment = environment;
    this.scene.backgroundRotation.y = -2.1;
    this.scene.environmentRotation.y = -2.1;
    this.setMode(this.mode);
    return this;
  }

  buildLighting() {
    this.hemisphere = new THREE.HemisphereLight(0xe7f0f5, 0x34393c, 0.22);
    this.sun = new THREE.DirectionalLight(0xfff4e7, 1.55);
    this.sun.position.set(8, 13, 7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 44;
    this.sun.shadow.camera.left = -11;
    this.sun.shadow.camera.right = 11;
    this.sun.shadow.camera.top = 11;
    this.sun.shadow.camera.bottom = -11;
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 2.2;

    this.fill = new THREE.DirectionalLight(0xc4dcf1, 0.2);
    this.fill.position.set(-7, 4, -5);
    this.stageKey = new THREE.DirectionalLight(0xe4ecff, 0);
    this.stageKey.position.set(5, 9, 5);
    this.stageKey.target.position.set(0, 0.55, 0);
    this.stageKey.castShadow = true;
    this.stageKey.shadow.mapSize.set(1024, 1024);
    this.stageKey.shadow.camera.left = -7;
    this.stageKey.shadow.camera.right = 7;
    this.stageKey.shadow.camera.top = 7;
    this.stageKey.shadow.camera.bottom = -7;
    this.stageRim = new THREE.PointLight(0xb994e6, 0, 13, 2);
    this.stageRim.position.set(-4, 2.8, -4);

    this.scene.add(
      this.hemisphere,
      this.sun,
      this.fill,
      this.stageKey,
      this.stageKey.target,
      this.stageRim,
    );
  }

  buildGrounds() {
    this.dayGroundMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.16,
      clearcoatRoughness: 0.58,
      color: 0x555c61,
      metalness: 0.03,
      roughness: 0.5,
    });
    const dayGround = surface(new THREE.PlaneGeometry(44, 44), this.dayGroundMaterial);
    dayGround.rotation.x = -Math.PI / 2;
    dayGround.position.y = -0.015;
    this.dayGroup.add(dayGround);

    const neonGround = surface(
      new THREE.PlaneGeometry(48, 48),
      new THREE.MeshPhysicalMaterial({ color: 0x08090d, metalness: 0.48, roughness: 0.32 }),
    );
    neonGround.rotation.x = -Math.PI / 2;
    neonGround.position.y = -0.02;
    this.neonGroup.add(neonGround);

    const stageGround = surface(
      new THREE.PlaneGeometry(48, 48),
      new THREE.MeshPhysicalMaterial({ color: 0x090a0d, metalness: 0.42, roughness: 0.42 }),
    );
    stageGround.rotation.x = -Math.PI / 2;
    stageGround.position.y = -0.03;
    this.stageGroup.add(stageGround);
  }

  addArchitecture(model) {
    model.name = 'Kenney commercial building';
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        material.color?.multiplyScalar(0.74);
        material.envMapIntensity = 0.42;
        material.metalness = Math.min(material.metalness ?? 0, 0.18);
        material.roughness = Math.max(material.roughness ?? 0.6, 0.62);
        material.needsUpdate = true;
      });
    });

    const initialBounds = new THREE.Box3().setFromObject(model);
    const size = initialBounds.getSize(new THREE.Vector3());
    const scale = 7.5 / size.y;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -bounds.min.y, -center.z);
    model.updateMatrixWorld(true);

    this.architecture = new THREE.Group();
    this.architecture.position.set(-20, 0, -12);
    this.architecture.rotation.y = Math.PI * 0.86;
    this.architecture.add(model);
    this.dayGroup.add(this.architecture);
  }

  buildNeonDetails() {
    const colors = [0xd12aa6, 0x5679e8, 0x30b8c6];
    for (let index = 0; index < 28; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: colors[index % colors.length],
        depthWrite: false,
        opacity: 0.42,
        transparent: true,
      });
      const streak = surface(new THREE.BoxGeometry(0.025, 0.012, 3 + seededRandom(index) * 6), material);
      streak.position.set(-16 + seededRandom(index + 20) * 32, 0.012, -20 + seededRandom(index + 40) * 40);
      streak.userData.speed = 5 + seededRandom(index + 60) * 8;
      this.neonGroup.add(streak);
      this.neonStreaks.push(streak);
    }
  }

  buildStageDetails() {
    const platformMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.22,
      clearcoatRoughness: 0.48,
      color: 0x111317,
      metalness: 0.18,
      roughness: 0.52,
    });
    this.stageGroup.add(
      surface(new THREE.CylinderGeometry(6.1, 6.25, 0.28, 128), platformMaterial, [0, 0.11, 0]),
      surface(new THREE.CylinderGeometry(4.85, 5, 0.2, 128), platformMaterial, [0, 0.34, 0]),
    );

    this.stageRing = surface(
      new THREE.TorusGeometry(6.32, 0.028, 8, 192),
      new THREE.MeshBasicMaterial({ color: 0xe5c27f, opacity: 0.55, transparent: true }),
      [0, 0.24, 0],
    );
    this.stageRing.rotation.x = Math.PI / 2;
    this.stageGroup.add(this.stageRing);
  }

  buildSnow() {
    const count = 360;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = -14 + seededRandom(index + 180) * 28;
      positions[index * 3 + 1] = seededRandom(index + 280) * 11;
      positions[index * 3 + 2] = -12 + seededRandom(index + 380) * 24;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.snow = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0xffffff, opacity: 0.62, size: 0.045, transparent: true }),
    );
    this.snow.visible = false;
    this.dayGroup.add(this.snow);
  }

  setMode(mode) {
    this.mode = mode;
    this.dayGroup.visible = mode === 'day';
    this.neonGroup.visible = mode === 'neon';
    this.stageGroup.visible = mode === 'stage';

    if (mode === 'day') this.applyDaylight();
    else this.applyDarkMode(MODE_LIGHTING[mode] ?? MODE_LIGHTING.stage);
    this.setWeather(this.weather);
  }

  applyDarkMode(profile) {
    this.scene.background = NIGHT_BACKGROUND;
    this.scene.environment = this.environmentTexture;
    this.scene.environmentIntensity = this.mode === 'stage' ? 0.32 : 0.24;
    this.scene.fog = new THREE.FogExp2(NIGHT_BACKGROUND, this.mode === 'neon' ? 0.015 : 0.021);
    this.hemisphere.intensity = profile.hemisphere;
    this.sun.intensity = 0;
    this.fill.intensity = profile.fill;
    this.stageKey.intensity = profile.key;
    this.stageRim.intensity = profile.rim;
  }

  setWeather(weather) {
    this.weather = WEATHER_PROFILES[weather] ? weather : 'sunny';
    if (this.snow) this.snow.visible = this.weather === 'snow' && this.mode === 'day';
    if (this.mode === 'day') this.applyDaylight();
  }

  setTimeOfDay(value) {
    this.timeOfDay = value;
    if (this.mode === 'day') this.applyDaylight();
  }

  applyDaylight() {
    if (!this.environmentTexture) return;
    const profile = WEATHER_PROFILES[this.weather] ?? WEATHER_PROFILES.sunny;
    const daylight = THREE.MathUtils.smoothstep(this.timeOfDay, 0.08, 0.68);
    this.scene.background = this.environmentTexture;
    this.scene.backgroundBlurriness = profile.blur;
    this.scene.backgroundIntensity = profile.background * (0.12 + daylight * 0.88);
    this.scene.environment = this.environmentTexture;
    this.scene.environmentIntensity = profile.environment * (0.24 + daylight * 0.76);
    this.scene.fog = new THREE.FogExp2(profile.fogColor, profile.fogDensity);
    this.sun.intensity = profile.sun * (0.08 + daylight * 0.92);
    this.hemisphere.intensity = profile.hemisphere * (0.25 + daylight * 0.75);
    this.fill.intensity = 0.08 + daylight * 0.12;
    this.stageKey.intensity = 0;
    this.stageRim.intensity = 0;
    this.dayGroundMaterial.roughness = this.weather === 'sunny' ? 0.5 : 0.6;
  }

  setSunAngle(value) {
    const angle = THREE.MathUtils.lerp(-Math.PI * 0.15, Math.PI * 0.78, value);
    this.sun.position.set(Math.cos(angle) * 15, 6 + Math.sin(angle) * 12, 8);
  }

  update(delta, elapsed) {
    if (this.mode === 'neon') {
      this.neonStreaks.forEach((streak) => {
        streak.position.z += streak.userData.speed * delta;
        if (streak.position.z > 21) streak.position.z = -21;
      });
    }
    if (this.mode === 'stage') this.stageRing.material.opacity = 0.48 + Math.sin(elapsed * 1.5) * 0.06;
    if (this.snow?.visible) {
      const positions = this.snow.geometry.attributes.position.array;
      for (let index = 1; index < positions.length; index += 3) {
        positions[index] -= delta * 1.05;
        if (positions[index] < 0.08) positions[index] = 11;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
  }
}
