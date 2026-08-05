import * as THREE from 'three/webgpu';
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js';
import { MODE_LIGHTING, WEATHER_PROFILES } from './environment/profiles.js';

const NIGHT_BACKGROUND = new THREE.Color(0x020407);

THREE.RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init());

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

function emissiveMaterial(hex, intensity = 6) {
  return new THREE.MeshStandardMaterial({
    color: 0x07090b,
    emissive: hex,
    emissiveIntensity: intensity,
    metalness: 0.25,
    roughness: 0.28,
  });
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
    this.dayGroup.name = 'Day plaza';
    this.neonGroup.name = 'Neon track';
    this.stageGroup.name = 'Black gold stage';
    this.root.add(this.dayGroup, this.neonGroup, this.stageGroup);
    this.scene.add(this.root);

    this.buildLighting();
    this.buildGrounds();
    this.buildDayArchitecture();
    this.buildNeonDetails();
    this.buildStageDetails();
    this.buildSnow();
  }

  async load() {
    this.environmentTexture = await this.assets.loadDayEnvironment();
    this.scene.environment = this.environmentTexture;
    this.scene.backgroundRotation.y = -2.08;
    this.scene.environmentRotation.y = -2.08;
    this.setMode(this.mode);
    return this;
  }

  buildLighting() {
    this.hemisphere = new THREE.HemisphereLight(0xeaf4f7, 0x262d32, 0.28);
    this.sun = new THREE.DirectionalLight(0xfff1df, 3.2);
    this.sun.position.set(8, 13, 7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 45;
    this.sun.shadow.camera.left = -11;
    this.sun.shadow.camera.right = 11;
    this.sun.shadow.camera.top = 11;
    this.sun.shadow.camera.bottom = -11;
    this.sun.shadow.bias = -0.00022;
    this.sun.shadow.normalBias = 0.028;
    this.sun.shadow.radius = 2.5;

    this.fill = new THREE.DirectionalLight(0xb9d5e7, 0.2);
    this.fill.position.set(-7, 4, -5);

    this.stageKey = new THREE.DirectionalLight(0xf0f4ff, 0);
    this.stageKey.position.set(5, 9, 5);
    this.stageKey.target.position.set(0, 0.55, 0);
    this.stageKey.castShadow = true;
    this.stageKey.shadow.mapSize.set(2048, 2048);
    this.stageKey.shadow.camera.near = 1;
    this.stageKey.shadow.camera.far = 28;
    this.stageKey.shadow.camera.left = -7;
    this.stageKey.shadow.camera.right = 7;
    this.stageKey.shadow.camera.top = 7;
    this.stageKey.shadow.camera.bottom = -7;
    this.stageKey.shadow.normalBias = 0.025;

    this.stageRim = new THREE.PointLight(0xb980e6, 0, 14, 2);
    this.stageRim.position.set(-4.3, 2.8, -4.2);

    this.scene.add(
      this.hemisphere,
      this.sun,
      this.sun.target,
      this.fill,
      this.stageKey,
      this.stageKey.target,
      this.stageRim,
    );

    this.dayAreaLights = [
      this.createAreaLight(this.dayGroup, 0xfff4e6, 7.2, 6.5, 2.4, [-4.5, 7.5, 5.2]),
      this.createAreaLight(this.dayGroup, 0xc9e5f2, 4.8, 5.2, 1.4, [5.5, 3.4, 1.2]),
      this.createAreaLight(this.dayGroup, 0xf5f7f4, 3.6, 4.5, 1.2, [-4.8, 2.4, -3.6]),
    ];
    this.neonAreaLights = [
      this.createAreaLight(this.neonGroup, 0xf124c1, 13, 5.5, 1.4, [-4.5, 2.5, -1.4]),
      this.createAreaLight(this.neonGroup, 0x4aaee8, 11, 5, 1.2, [4.8, 2.1, 2.8]),
      this.createAreaLight(this.neonGroup, 0x7457ff, 8, 4.5, 1, [1.2, 4.8, -4.5]),
    ];
    this.stageAreaLights = [
      this.createAreaLight(this.stageGroup, 0xf1f5ff, 12, 6.8, 1.9, [-3.5, 6.2, 4.8]),
      this.createAreaLight(this.stageGroup, 0xe2b96c, 9, 5.2, 1.15, [5.6, 3.3, -2.7]),
      this.createAreaLight(this.stageGroup, 0xa88ae0, 7, 4.8, 1.1, [-5.2, 2.5, -3.2]),
    ];
  }

  createAreaLight(parent, lightColor, intensity, width, height, position) {
    const light = new THREE.RectAreaLight(lightColor, intensity, width, height);
    light.position.set(...position);
    light.lookAt(0, 0.65, 0);
    parent.add(light);
    return light;
  }

  buildGrounds() {
    this.dayGroundMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.24,
      clearcoatRoughness: 0.42,
      color: 0x596166,
      metalness: 0.04,
      roughness: 0.38,
    });
    const dayGround = surface(new THREE.PlaneGeometry(54, 54), this.dayGroundMaterial);
    dayGround.rotation.x = -Math.PI / 2;
    dayGround.position.y = -0.025;
    this.dayGroup.add(dayGround);

    this.dayReflection = this.createReflectiveSurface(
      new THREE.PlaneGeometry(19, 9.5),
      0x526169,
      0.48,
    );
    this.dayReflection.rotation.x = -Math.PI / 2;
    this.dayReflection.position.set(0, -0.006, -1.2);
    this.dayGroup.add(this.dayReflection);
    this.dayGroup.add(this.createShadowCatcher(new THREE.PlaneGeometry(19, 9.5), [0, 0.002, -1.2], 0.24));

    const neonGround = surface(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.7,
        clearcoatRoughness: 0.18,
        color: 0x05070b,
        metalness: 0.48,
        roughness: 0.24,
      }),
    );
    neonGround.rotation.x = -Math.PI / 2;
    neonGround.position.y = -0.032;
    this.neonGroup.add(neonGround);

    this.neonReflection = this.createReflectiveSurface(
      new THREE.PlaneGeometry(42, 42),
      0x05070b,
      0.36,
      { unlit: true },
    );
    this.neonReflection.rotation.x = -Math.PI / 2;
    this.neonReflection.position.y = -0.014;
    this.neonGroup.add(this.neonReflection);
    this.neonGroup.add(this.createShadowCatcher(new THREE.PlaneGeometry(42, 42), [0, -0.008, 0], 0.32));

    const stageGround = surface(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshPhysicalMaterial({ color: 0x050608, metalness: 0.38, roughness: 0.52 }),
    );
    stageGround.rotation.x = -Math.PI / 2;
    stageGround.position.y = -0.035;
    this.stageGroup.add(stageGround);
  }

  createReflectiveSurface(geometry, tint, amount, overrides = {}) {
    const { unlit = false, ...materialOverrides } = overrides;
    const material = unlit
      ? new THREE.MeshBasicMaterial({ color: tint })
      : new THREE.MeshPhysicalMaterial({
        clearcoat: Math.min(amount * 1.8, 1),
        clearcoatRoughness: THREE.MathUtils.lerp(0.28, 0.1, amount),
        color: tint,
        envMapIntensity: THREE.MathUtils.lerp(1.15, 2.25, amount),
        metalness: THREE.MathUtils.lerp(0.16, 0.46, amount),
        roughness: THREE.MathUtils.lerp(0.34, 0.14, amount),
        ...materialOverrides,
      });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  createShadowCatcher(geometry, position, opacity) {
    const mesh = surface(geometry, new THREE.ShadowMaterial({ color: 0x000000, opacity }), position);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    return mesh;
  }

  buildDayArchitecture() {
    const white = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.16,
      clearcoatRoughness: 0.42,
      color: 0xe6e9e7,
      metalness: 0.04,
      roughness: 0.36,
    });
    const graphite = new THREE.MeshPhysicalMaterial({
      color: 0x1d252a,
      metalness: 0.16,
      roughness: 0.48,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x91acb8,
      envMapIntensity: 1.4,
      metalness: 0,
      opacity: 0.28,
      roughness: 0.09,
      side: THREE.DoubleSide,
      transparent: true,
      transmission: 0.2,
    });

    this.architecture = new THREE.Group();
    this.architecture.name = 'Futurist plaza architecture';
    this.dayGroup.add(this.architecture);

    this.addBox(this.architecture, [17, 0.55, 4.8], [-2.8, 5.35, -12.8], [0.03, -0.13, -0.035], white);
    this.addBox(this.architecture, [10, 0.42, 3.7], [8.4, 4.05, -11.2], [-0.08, 0.34, 0.08], white);
    this.addBox(this.architecture, [8.5, 0.35, 3.2], [-11.2, 3.45, -9.8], [0.05, -0.38, -0.08], white);
    this.addBox(this.architecture, [0.55, 5.3, 2.3], [-7.7, 2.55, -12.4], [0, -0.08, 0.02], white);
    this.addBox(this.architecture, [0.6, 4.4, 2.1], [5.8, 2.15, -12.1], [0, 0.1, -0.03], white);
    this.addBox(this.architecture, [13.5, 2.5, 0.28], [0, 1.55, -14.35], [0, -0.03, 0], glass);
    this.addBox(this.architecture, [15.5, 0.18, 1.6], [0.4, 0.08, -10.4], [0, -0.05, 0], graphite);

    const channelMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      color: 0x334b57,
      metalness: 0.15,
      roughness: 0.14,
    });
    const channel = surface(new THREE.PlaneGeometry(5, 28), channelMaterial, [-7.9, -0.004, -1.5]);
    channel.rotation.x = -Math.PI / 2;
    channel.rotation.z = -0.16;
    this.dayGroup.add(channel);

    const seamMaterial = emissiveMaterial(0xdcebf0, 0.7);
    for (let index = -3; index <= 3; index += 1) {
      const seam = surface(new THREE.BoxGeometry(0.018, 0.012, 18), seamMaterial, [index * 3.4, 0, 0]);
      seam.rotation.y = 0.06;
      this.dayGroup.add(seam);
    }
  }

  addBox(parent, size, position, rotation, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  buildNeonDetails() {
    const colors = [0xf229bd, 0x5b78ff, 0x2bd0d8, 0xf2c84b];
    for (let index = 0; index < 38; index += 1) {
      const hex = colors[index % colors.length];
      const length = 3.5 + seededRandom(index) * 7.5;
      const streak = surface(
        new THREE.BoxGeometry(0.035 + seededRandom(index + 5) * 0.035, 0.022, length),
        emissiveMaterial(hex, 8 + seededRandom(index + 8) * 5),
      );
      streak.position.set(
        -16 + seededRandom(index + 20) * 32,
        -0.002,
        -20 + seededRandom(index + 40) * 40,
      );
      streak.userData.speed = 5 + seededRandom(index + 60) * 9;
      this.neonGroup.add(streak);
      this.neonStreaks.push(streak);
    }

    const magenta = emissiveMaterial(0xf023c1, 11);
    const blue = emissiveMaterial(0x556eff, 9);
    [
      [-6.5, 2.3, -4, 0.18, magenta],
      [6.2, 1.5, -1, -0.24, blue],
      [-5.5, 4.2, 2.5, -0.32, blue],
      [5.8, 3.6, 4, 0.28, magenta],
    ].forEach(([x, y, z, rotation, material]) => {
      const rail = surface(new THREE.BoxGeometry(0.055, 0.055, 8.5), material, [x, y, z]);
      rail.rotation.set(rotation, rotation * 0.4, rotation * 0.22);
      this.neonGroup.add(rail);
    });
  }

  buildStageDetails() {
    const platformMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.34,
      clearcoatRoughness: 0.32,
      color: 0x0d1014,
      metalness: 0.34,
      roughness: 0.38,
    });
    this.stageGroup.add(
      surface(new THREE.CylinderGeometry(6.1, 6.28, 0.28, 128), platformMaterial, [0, 0.11, 0]),
      surface(new THREE.CylinderGeometry(4.86, 5.02, 0.2, 128), platformMaterial, [0, 0.34, 0]),
    );

    this.stageReflection = this.createReflectiveSurface(
      new THREE.CircleGeometry(4.82, 128),
      0x0b0d12,
      0.5,
      { unlit: true },
    );
    this.stageReflection.rotation.x = -Math.PI / 2;
    this.stageReflection.position.y = 0.445;
    this.stageGroup.add(this.stageReflection);
    this.stageGroup.add(this.createShadowCatcher(new THREE.CircleGeometry(4.82, 128), [0, 0.451, 0], 0.34));

    this.stageRingMaterial = emissiveMaterial(0xe6bd71, 5.8);
    this.stageRingMaterial.transparent = true;
    this.stageRingMaterial.opacity = 0.82;
    this.stageRing = surface(
      new THREE.TorusGeometry(6.32, 0.035, 12, 192),
      this.stageRingMaterial,
      [0, 0.25, 0],
    );
    this.stageRing.rotation.x = Math.PI / 2;
    this.stageGroup.add(this.stageRing);

    const wallMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x090b0e,
      metalness: 0.44,
      roughness: 0.42,
    });
    const slatGeometry = new THREE.BoxGeometry(0.16, 4.8, 0.5);
    for (let index = 0; index < 64; index += 1) {
      const angle = (index / 64) * Math.PI * 2;
      const radius = 8.25;
      const slat = new THREE.Mesh(slatGeometry, wallMaterial);
      slat.position.set(Math.sin(angle) * radius, 2.35, Math.cos(angle) * radius);
      slat.rotation.y = angle;
      slat.castShadow = true;
      slat.receiveShadow = true;
      this.stageGroup.add(slat);
    }

    const wallRingMaterial = emissiveMaterial(0xd8ad63, 3.6);
    [1.18, 4.5].forEach((height) => {
      const ring = surface(new THREE.TorusGeometry(8.03, 0.025, 10, 192), wallRingMaterial, [0, height, 0]);
      ring.rotation.x = Math.PI / 2;
      this.stageGroup.add(ring);
    });
  }

  buildSnow() {
    const count = 420;
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
      new THREE.PointsMaterial({
        color: 0xffffff,
        depthWrite: false,
        opacity: 0.72,
        size: 0.045,
        transparent: true,
      }),
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
    this.scene.backgroundBlurriness = 0;
    this.scene.backgroundIntensity = 1;
    this.scene.environment = this.environmentTexture;
    this.scene.environmentIntensity = profile.environment;
    this.scene.fog = new THREE.FogExp2(NIGHT_BACKGROUND, profile.fogDensity);
    this.hemisphere.intensity = profile.hemisphere;
    this.sun.intensity = 0;
    this.fill.intensity = profile.fill;
    this.stageKey.intensity = profile.key;
    this.stageRim.intensity = profile.rim;

    if (this.mode === 'neon') {
      this.stageKey.color.setHex(0xd8e6ff);
      this.neonAreaLights[0].intensity = 13;
      this.neonAreaLights[1].intensity = 11;
      this.neonAreaLights[2].intensity = 8;
    } else {
      this.stageKey.color.setHex(0xf0f4ff);
      this.stageAreaLights[0].intensity = 12;
      this.stageAreaLights[1].intensity = 9;
      this.stageAreaLights[2].intensity = 7;
    }
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
    const daylight = THREE.MathUtils.smoothstep(this.timeOfDay, 0.08, 0.7);
    this.scene.background = this.environmentTexture;
    this.scene.backgroundBlurriness = profile.blur;
    this.scene.backgroundIntensity = profile.background * (0.18 + daylight * 0.82);
    this.scene.environment = this.environmentTexture;
    this.scene.environmentIntensity = profile.environment * (0.3 + daylight * 0.7);
    this.scene.fog = new THREE.FogExp2(profile.fogColor, profile.fogDensity);

    this.sun.color.setHex(profile.sunColor);
    this.sun.intensity = profile.sun * (0.1 + daylight * 0.9);
    this.hemisphere.intensity = profile.hemisphere * (0.32 + daylight * 0.68);
    this.fill.intensity = 0.1 + daylight * 0.18;
    this.stageKey.intensity = 0;
    this.stageRim.intensity = 0;
    this.dayAreaLights[0].intensity = profile.softbox * (0.42 + daylight * 0.58);
    this.dayAreaLights[1].intensity = profile.softbox * 0.64;
    this.dayAreaLights[2].intensity = profile.softbox * 0.42;
    this.dayGroundMaterial.color.setHex(profile.groundColor);
    this.dayGroundMaterial.roughness = profile.groundRoughness;
  }

  setSunAngle(value) {
    const angle = THREE.MathUtils.lerp(-Math.PI * 0.18, Math.PI * 0.78, value);
    this.sun.position.set(Math.cos(angle) * 15, 6.5 + Math.sin(angle) * 12, 8.5);
  }

  update(delta, elapsed) {
    if (this.mode === 'neon') {
      this.neonStreaks.forEach((streak) => {
        streak.position.z += streak.userData.speed * delta;
        if (streak.position.z > 22) streak.position.z = -22;
      });
    }

    if (this.mode === 'stage') {
      this.stageRingMaterial.emissiveIntensity = 5.5 + Math.sin(elapsed * 1.45) * 0.55;
      this.stageRingMaterial.opacity = 0.78 + Math.sin(elapsed * 1.45) * 0.06;
    }

    if (this.snow?.visible) {
      const positions = this.snow.geometry.attributes.position.array;
      for (let index = 1; index < positions.length; index += 3) {
        positions[index] -= delta * 1.05;
        if (positions[index] < 0.08) positions[index] = 11;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose() {}
}
