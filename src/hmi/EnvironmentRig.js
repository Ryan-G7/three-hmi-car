import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

const DAY_SKY = new THREE.Color(0xa9bdc8);
const NIGHT_SKY = new THREE.Color(0x020307);

function createMesh(geometry, material, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function seededRandom(seed) {
  const value = Math.sin(seed * 91.719) * 43758.5453;
  return value - Math.floor(value);
}

function createReflector(width, height, color, opacity = 1) {
  const reflector = new Reflector(new THREE.PlaneGeometry(width, height), {
    clipBias: 0.002,
    color,
    multisample: 4,
    textureHeight: Math.min(1024, window.innerHeight * window.devicePixelRatio),
    textureWidth: Math.min(1024, window.innerWidth * window.devicePixelRatio),
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.material.transparent = opacity < 1;
  reflector.material.opacity = opacity;
  reflector.receiveShadow = true;
  return reflector;
}

export class EnvironmentRig {
  constructor(scene) {
    this.scene = scene;
    this.mode = 'day';
    this.weather = 'sunny';
    this.timeOfDay = 0.78;
    this.daySky = DAY_SKY.clone();
    this.daySunIntensity = 1.85;
    this.dayHemisphereIntensity = 1.1;
    this.neonStreaks = [];
    this.reflectors = [];

    this.root = new THREE.Group();
    this.dayGroup = new THREE.Group();
    this.neonGroup = new THREE.Group();
    this.stageGroup = new THREE.Group();
    this.root.add(this.dayGroup, this.neonGroup, this.stageGroup);
    this.scene.add(this.root);

    this.buildLights();
    this.buildDayEnvironment();
    this.buildNeonEnvironment();
    this.buildStageEnvironment();
    this.buildSnow();
    this.setMode('day');
  }

  buildLights() {
    this.hemisphere = new THREE.HemisphereLight(0xe7f2fa, 0x303438, 1.1);
    this.sun = new THREE.DirectionalLight(0xfff3df, 1.85);
    this.sun.position.set(8, 13, 7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 48;
    this.sun.shadow.camera.left = -13;
    this.sun.shadow.camera.right = 13;
    this.sun.shadow.camera.top = 13;
    this.sun.shadow.camera.bottom = -13;
    this.sun.shadow.bias = -0.0004;

    this.fill = new THREE.DirectionalLight(0xb4d7ff, 0.42);
    this.fill.position.set(-8, 5, -5);

    this.stageKey = new THREE.SpotLight(0xe4ecff, 0, 26, Math.PI * 0.29, 0.7, 1.1);
    this.stageKey.position.set(5, 9, 5);
    this.stageKey.target.position.set(0, 0.5, 0);
    this.stageKey.castShadow = true;

    this.stageRim = new THREE.PointLight(0xb783ff, 0, 18, 1.4);
    this.stageRim.position.set(-4, 2.8, -4);

    this.stageFill = new THREE.DirectionalLight(0xbfd8ff, 0);
    this.stageFill.position.set(-6, 4.5, 8);
    this.stageWarm = new THREE.PointLight(0xffcb8a, 0, 24, 1.45);
    this.stageWarm.position.set(5.5, 3.2, 4.5);

    this.scene.add(
      this.hemisphere,
      this.sun,
      this.fill,
      this.stageKey,
      this.stageKey.target,
      this.stageRim,
      this.stageFill,
      this.stageWarm,
    );
  }

  buildDayEnvironment() {
    const plazaMaterial = new THREE.MeshStandardMaterial({
      color: 0xbcc3c5,
      metalness: 0.08,
      roughness: 0.72,
    });
    const promenade = createMesh(new THREE.BoxGeometry(18, 0.16, 28), plazaMaterial, [-5.7, -0.09, 0]);
    this.dayGroup.add(promenade);

    const insetMaterial = new THREE.MeshStandardMaterial({ color: 0x8f989c, roughness: 0.56 });
    for (let index = 0; index < 16; index += 1) {
      const stripe = createMesh(new THREE.BoxGeometry(0.025, 0.012, 17), insetMaterial);
      stripe.position.set(-13.4 + index * 1.05, 0.006, 0);
      stripe.castShadow = false;
      this.dayGroup.add(stripe);
    }

    const water = createReflector(24, 38, 0x8aa2ae, 0.9);
    water.position.set(14.8, -0.04, -1);
    this.dayGroup.add(water);
    this.reflectors.push(water);

    const rim = createMesh(
      new THREE.BoxGeometry(0.18, 0.22, 31),
      new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.48 }),
      [3.32, 0.02, 0],
    );
    this.dayGroup.add(rim);

    const architectureMaterial = new THREE.MeshStandardMaterial({
      color: 0xe7e7e2,
      metalness: 0.02,
      roughness: 0.54,
    });
    const canopy = createMesh(new THREE.BoxGeometry(28, 0.68, 2.5), architectureMaterial, [0, 1.25, -10.5]);
    canopy.rotation.z = -0.035;
    this.dayGroup.add(canopy);

    const arc = createMesh(new THREE.TorusGeometry(12.8, 0.62, 10, 96, Math.PI), architectureMaterial, [0, -4.7, -9.4]);
    arc.scale.y = 0.56;
    this.dayGroup.add(arc);

    const farBand = createMesh(new THREE.BoxGeometry(42, 0.52, 2.2), architectureMaterial, [0, 1.7, -18]);
    farBand.rotation.z = 0.025;
    this.dayGroup.add(farBand);

    const mountainTexture = new THREE.TextureLoader().load('/environment/himalaya-panorama.jpg');
    mountainTexture.colorSpace = THREE.SRGBColorSpace;
    mountainTexture.anisotropy = 8;
    mountainTexture.wrapS = THREE.RepeatWrapping;
    mountainTexture.repeat.x = 2;
    mountainTexture.offset.x = 0.25;
    this.mountainMaterial = new THREE.MeshBasicMaterial({
      color: 0xc4cfd3,
      fog: true,
      map: mountainTexture,
      side: THREE.BackSide,
    });
    const mountainBackdrop = createMesh(
      new THREE.CylinderGeometry(48, 48, 15, 160, 1, true),
      this.mountainMaterial,
      [0, 6.75, 0],
    );
    mountainBackdrop.castShadow = false;
    mountainBackdrop.receiveShadow = false;
    this.dayGroup.add(mountainBackdrop);
  }

  buildNeonEnvironment() {
    const floor = createReflector(54, 54, 0x05050b, 0.94);
    floor.position.y = -0.045;
    this.neonGroup.add(floor);
    this.reflectors.push(floor);

    const colors = [0xf026bd, 0x7147ff, 0x2bcbff, 0xff355e, 0xffe27a];
    for (let index = 0; index < 74; index += 1) {
      const color = colors[index % colors.length];
      const length = 2 + seededRandom(index + 10) * 8;
      const material = new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        color,
        depthWrite: false,
        transparent: true,
        opacity: 0.62,
      });
      const streak = createMesh(new THREE.BoxGeometry(0.028, 0.018, length), material);
      streak.position.set(-20 + seededRandom(index + 30) * 40, 0.015, -24 + seededRandom(index + 40) * 48);
      streak.castShadow = false;
      streak.receiveShadow = false;
      streak.userData.speed = 7 + seededRandom(index + 50) * 14;
      this.neonGroup.add(streak);
      this.neonStreaks.push(streak);
    }

    for (let index = 0; index < 26; index += 1) {
      const color = colors[(index + 2) % colors.length];
      const material = new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        color,
        depthWrite: false,
        transparent: true,
        opacity: 0.5,
      });
      const beam = createMesh(new THREE.BoxGeometry(0.035, 0.035, 7 + seededRandom(index + 2) * 11), material);
      beam.position.set(-19 + seededRandom(index + 70) * 38, 3 + seededRandom(index + 90) * 7, -20 + seededRandom(index + 110) * 38);
      beam.rotation.x = -0.35 + seededRandom(index + 120) * 0.7;
      beam.rotation.z = -0.45 + seededRandom(index + 130) * 0.9;
      beam.castShadow = false;
      this.neonGroup.add(beam);
      this.neonStreaks.push(beam);
    }

    const neonLights = [
      [0xf12bbc, -6, 2.3, 2],
      [0x3b72ff, 5, 2.8, -4],
      [0x25e8d1, 2, 1.2, 5],
    ];
    neonLights.forEach(([color, x, y, z]) => {
      const light = new THREE.PointLight(color, 32, 17, 2);
      light.position.set(x, y, z);
      this.neonGroup.add(light);
    });
  }

  buildStageEnvironment() {
    const floor = createReflector(48, 48, 0x050506, 0.96);
    floor.position.y = -0.055;
    this.stageGroup.add(floor);
    this.reflectors.push(floor);

    const platformMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x111318,
      metalness: 0.82,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    });
    const lowerPlatform = createMesh(new THREE.CylinderGeometry(6.1, 6.25, 0.34, 128), platformMaterial, [0, 0.08, 0]);
    const upperPlatform = createMesh(new THREE.CylinderGeometry(4.85, 5, 0.25, 128), platformMaterial, [0, 0.35, 0]);
    this.stageGroup.add(lowerPlatform, upperPlatform);

    const goldMaterial = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xffd77d,
      depthWrite: false,
      toneMapped: false,
      transparent: true,
    });
    this.stageRing = createMesh(new THREE.TorusGeometry(6.36, 0.034, 8, 192), goldMaterial, [0, 0.22, 0]);
    this.stageRing.rotation.x = Math.PI / 2;
    this.stageGroup.add(this.stageRing);

    const ribMaterial = new THREE.MeshStandardMaterial({ color: 0x0b0c10, metalness: 0.66, roughness: 0.38 });
    for (let index = 0; index < 48; index += 1) {
      const angle = (index / 48) * Math.PI * 2;
      const rib = createMesh(new THREE.BoxGeometry(0.26, 6.4, 0.8), ribMaterial);
      rib.position.set(Math.cos(angle) * 10.2, 3.1, Math.sin(angle) * 10.2);
      rib.rotation.y = -angle;
      this.stageGroup.add(rib);
    }
  }

  buildSnow() {
    const count = 520;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = -16 + seededRandom(index + 180) * 32;
      positions[index * 3 + 1] = seededRandom(index + 280) * 12;
      positions[index * 3 + 2] = -14 + seededRandom(index + 380) * 28;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.055, transparent: true, opacity: 0.72 });
    this.snow = new THREE.Points(geometry, material);
    this.snow.visible = false;
    this.dayGroup.add(this.snow);
  }

  setMode(mode) {
    this.mode = mode;
    this.dayGroup.visible = mode === 'day';
    this.neonGroup.visible = mode === 'neon';
    this.stageGroup.visible = mode === 'stage';
    this.stageKey.intensity = mode === 'stage' ? 6.4 : mode === 'neon' ? 4.5 : 0;
    this.stageRim.intensity = mode === 'stage' ? 3.8 : mode === 'neon' ? 4.5 : 0;
    this.stageFill.intensity = mode === 'stage' ? 2.1 : 0;
    this.stageWarm.intensity = mode === 'stage' ? 3.4 : 0;
    this.hemisphere.intensity = mode === 'day' ? 1.1 : mode === 'neon' ? 0.24 : 0.36;
    this.sun.intensity = mode === 'day' ? 1.85 : 0;
    this.fill.intensity = mode === 'day' ? 0.42 : mode === 'stage' ? 0.55 : 0.2;
    this.scene.fog = mode === 'day'
      ? new THREE.FogExp2(DAY_SKY, 0.008)
      : new THREE.FogExp2(NIGHT_SKY, mode === 'neon' ? 0.018 : 0.025);
    this.scene.background = mode === 'day' ? DAY_SKY.clone() : NIGHT_SKY.clone();
    this.setWeather(this.weather);
    this.setTimeOfDay(this.timeOfDay);
  }

  setWeather(weather) {
    this.weather = weather;
    if (this.snow) this.snow.visible = weather === 'snow' && this.mode === 'day';
    if (this.mode !== 'day') return;

    const presets = {
      sunny: { sky: 0xa9bdc8, fog: 0.008, sun: 1.85, hemi: 1.1 },
      cloudy: { sky: 0x87979f, fog: 0.012, sun: 0.82, hemi: 0.92 },
      snow: { sky: 0xc3cdd2, fog: 0.022, sun: 0.58, hemi: 1.18 },
      fog: { sky: 0xa7b0b3, fog: 0.052, sun: 0.22, hemi: 0.88 },
    };
    const preset = presets[weather] ?? presets.sunny;
    const sky = new THREE.Color(preset.sky);
    this.daySky.copy(sky);
    this.daySunIntensity = preset.sun;
    this.dayHemisphereIntensity = preset.hemi;
    this.scene.fog = new THREE.FogExp2(sky, preset.fog);
    this.applyDaylight();
  }

  setTimeOfDay(value) {
    this.timeOfDay = value;
    this.applyDaylight();
  }

  applyDaylight() {
    if (this.mode !== 'day') return;
    const daylight = THREE.MathUtils.smoothstep(this.timeOfDay, 0.08, 0.68);
    this.scene.background = NIGHT_SKY.clone().lerp(this.daySky, daylight);
    this.sun.intensity = this.daySunIntensity * (0.15 + daylight * 0.85);
    this.hemisphere.intensity = 0.2 + this.dayHemisphereIntensity * daylight;
    if (this.mountainMaterial) {
      const mountainLight = 0.18 + daylight * 0.82;
      this.mountainMaterial.color.setRGB(
        0.77 * mountainLight,
        0.81 * mountainLight,
        0.83 * mountainLight,
      );
    }
  }

  setSunAngle(value) {
    const angle = THREE.MathUtils.lerp(-Math.PI * 0.15, Math.PI * 0.78, value);
    this.sun.position.set(Math.cos(angle) * 15, 6 + Math.sin(angle) * 12, 8);
  }

  update(delta, elapsed) {
    if (this.mode === 'neon') {
      this.neonStreaks.forEach((streak) => {
        streak.position.z += streak.userData.speed ? streak.userData.speed * delta : 0;
        if (streak.position.z > 25) streak.position.z = -25;
      });
    }
    if (this.mode === 'stage') {
      this.stageRing.material.opacity = 0.78 + Math.sin(elapsed * 1.8) * 0.14;
    }
    if (this.snow?.visible) {
      const positions = this.snow.geometry.attributes.position.array;
      for (let index = 1; index < positions.length; index += 3) {
        positions[index] -= delta * 1.15;
        if (positions[index] < 0.08) positions[index] = 12;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose() {
    this.reflectors.forEach((reflector) => reflector.getRenderTarget?.().dispose());
  }
}
