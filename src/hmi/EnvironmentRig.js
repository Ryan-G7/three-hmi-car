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

function createNeonSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  const background = context.createLinearGradient(0, 0, 0, canvas.height);
  background.addColorStop(0, '#02050d');
  background.addColorStop(0.58, '#07101d');
  background.addColorStop(1, '#111425');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = '#d7e9ff';
  for (let index = 0; index < 620; index += 1) {
    const x = seededRandom(index + 5100) * canvas.width;
    const y = seededRandom(index + 5300) * canvas.height * 0.72;
    const radius = 0.07 + seededRandom(index + 5500) * 0.18;
    context.globalAlpha = 0.08 + seededRandom(index + 5700) * 0.26;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = 1;
  context.globalCompositeOperation = 'screen';
  for (let band = 0; band < 4; band += 1) {
    const bandY = 58 + band * 38;
    const gradient = context.createLinearGradient(0, bandY, 0, bandY + 100);
    gradient.addColorStop(0, 'rgba(20, 255, 149, 0)');
    gradient.addColorStop(0.46, `rgba(24, 235, ${132 + band * 10}, ${0.18 + band * 0.02})`);
    gradient.addColorStop(1, 'rgba(25, 126, 152, 0)');
    context.strokeStyle = gradient;
    context.lineWidth = 30 + band * 5;
    context.shadowBlur = 48;
    context.shadowColor = band % 2 ? '#18bb91' : '#21e595';
    context.beginPath();
    context.moveTo(-80, bandY + seededRandom(band + 5900) * 24);
    context.bezierCurveTo(
      180,
      bandY - 72 + band * 7,
      380,
      bandY + 88 - band * 4,
      590,
      bandY + 8,
    );
    context.bezierCurveTo(
      760,
      bandY - 76 + band * 4,
      920,
      bandY + 62,
      1100,
      bandY - 12,
    );
    context.stroke();
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export class EnvironmentRig {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.mode = 'day';
    this.weather = 'sunny';
    this.timeOfDay = 0.78;
    this.neonStreaks = [];
    this.neonRoadMarkers = [];

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
    this.buildWeatherEffects();
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
      this.createAreaLight(this.neonGroup, 0xf124c1, 6.8, 4.8, 1.05, [-4.5, 2.5, -1.4]),
      this.createAreaLight(this.neonGroup, 0x4aaee8, 5.6, 4.6, 0.95, [4.8, 2.1, 2.8]),
      this.createAreaLight(this.neonGroup, 0x7457ff, 4.4, 4.2, 0.85, [1.2, 4.8, -4.5]),
      this.createAreaLight(this.neonGroup, 0xffb45e, 3.2, 3.2, 0.65, [-2.2, 1.35, 4.5]),
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
    this.dayShadowCatcher = this.createShadowCatcher(
      new THREE.PlaneGeometry(19, 9.5),
      [0, 0.002, -1.2],
      0.24,
    );
    this.dayGroup.add(this.dayShadowCatcher);

    const neonGround = surface(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.16,
        clearcoatRoughness: 0.48,
        color: 0x010207,
        envMapIntensity: 0.12,
        metalness: 0.03,
        roughness: 0.86,
        specularIntensity: 0.08,
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
    this.neonSkyTexture = createNeonSkyTexture();
    this.neonSky = new THREE.Mesh(
      new THREE.SphereGeometry(72, 64, 32),
      new THREE.MeshBasicMaterial({
        depthWrite: false,
        fog: false,
        map: this.neonSkyTexture,
        side: THREE.BackSide,
      }),
    );
    this.neonSky.name = 'Neon aurora sky';
    this.neonSky.position.y = 7;
    this.neonSky.rotation.y = -0.7;
    this.neonGroup.add(this.neonSky);

    const road = surface(
      new THREE.PlaneGeometry(12.6, 150),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.12,
        clearcoatRoughness: 0.48,
        color: 0x010207,
        envMapIntensity: 0.16,
        metalness: 0.02,
        roughness: 0.84,
        specularIntensity: 0.08,
      }),
      [0, -0.006, 24],
    );
    road.rotation.x = -Math.PI / 2;
    this.neonGroup.add(road);

    const markerMaterial = emissiveMaterial(0xe7f1ff, 3.3);
    const markerGeometry = new THREE.BoxGeometry(0.045, 0.012, 2.5);
    [-2.25, 2.25].forEach((x, laneIndex) => {
      for (let index = 0; index < 18; index += 1) {
        const marker = surface(markerGeometry, markerMaterial, [x, 0.012, -20 + index * 6.2 + laneIndex * 3.1]);
        marker.userData.speed = 34;
        marker.userData.minZ = -9.2;
        marker.userData.maxZ = 88;
        this.neonGroup.add(marker);
        this.neonRoadMarkers.push(marker);
      }
    });

    const edgeMaterials = [emissiveMaterial(0xff3ac8, 1.8), emissiveMaterial(0x5acdf4, 1.8)];
    [-6.12, 6.12].forEach((x, index) => {
      const edge = surface(new THREE.BoxGeometry(0.055, 0.04, 112), edgeMaterials[index], [x, 0.04, 46]);
      this.neonGroup.add(edge);
    });

    const colors = [
      0xff26bf,
      0xff26bf,
      0xff26bf,
      0xd733ff,
      0xa94cff,
      0xa94cff,
      0x7b56ff,
      0x438cff,
      0x4bdde2,
      0xd7ecff,
      0xffbe58,
    ];
    const streakMaterials = colors.map((hex, index) => {
      const material = emissiveMaterial(hex, 3.2 + (index % 3) * 0.3);
      material.depthWrite = false;
      material.opacity = 0.74;
      material.transparent = true;
      return material;
    });
    const headMaterials = colors.map((hex, index) => {
      const material = emissiveMaterial(hex, 7.2 + (index % 3) * 0.55);
      material.depthWrite = false;
      material.opacity = 0.94;
      material.transparent = true;
      return material;
    });
    const streakGeometry = new THREE.BoxGeometry(1, 1, 1);

    const addStreakLayer = (count, layer, seedOffset) => {
      for (let index = 0; index < count; index += 1) {
        const seed = seedOffset + index * 17;
        const isGround = layer === 'ground';
        const randomX = seededRandom(seed + 2) * 2 - 1;
        const x = randomX * (isGround ? 10.8 : 12.8);
        const y = isGround
          ? 0.018 + seededRandom(seed + 3) * 0.055
          : layer === 'sky'
            ? 2.7 + Math.pow(seededRandom(seed + 3), 0.8) * 7.2
            : 0.4 + Math.pow(seededRandom(seed + 3), 0.78) * 3.2;
        const length = (isGround ? 2.8 : 2.2) + seededRandom(seed + 4) * (isGround ? 9.5 : 10.8);
        const thickness = (isGround ? 0.007 : 0.006) + seededRandom(seed + 5) * (isGround ? 0.014 : 0.016);
        const colorIndex = Math.floor(seededRandom(seed + 6) * colors.length);
        const streak = new THREE.Group();
        const trail = new THREE.Mesh(streakGeometry, streakMaterials[colorIndex]);
        const head = new THREE.Mesh(streakGeometry, headMaterials[colorIndex]);
        streak.position.set(x, y, -22 + seededRandom(seed + 7) * 112);
        trail.scale.set(thickness, thickness * (isGround ? 0.42 : 0.68), length);
        const headLength = Math.min(0.46, length * 0.07);
        head.position.z = -length * 0.5 + headLength * 0.5;
        head.scale.set(thickness * 1.22, thickness * (isGround ? 0.64 : 0.86), headLength);
        trail.castShadow = false;
        trail.receiveShadow = false;
        head.castShadow = false;
        head.receiveShadow = false;
        streak.add(trail, head);
        streak.userData.speed = (isGround ? 38 : layer === 'sky' ? 19 : 27)
          + seededRandom(seed + 8) * (isGround ? 22 : 16);
        streak.userData.minZ = -9.2;
        streak.userData.maxZ = 92;
        streak.userData.phase = seededRandom(seed + 9) * Math.PI * 2;
        streak.userData.trail = trail;
        streak.userData.baseScaleY = trail.scale.y;
        this.neonGroup.add(streak);
        this.neonStreaks.push(streak);
      }
    };

    addStreakLayer(54, 'ground', 300);
    addStreakLayer(42, 'mid', 1400);
    addStreakLayer(28, 'sky', 2700);

    const mountainShape = new THREE.Shape();
    mountainShape.moveTo(-38, -0.4);
    for (let index = 0; index <= 24; index += 1) {
      const x = -38 + index * (76 / 24);
      const ridge = 0.7 + seededRandom(4100 + index) * 2.4 + Math.sin(index * 1.63) * 0.55;
      mountainShape.lineTo(x, ridge);
    }
    mountainShape.lineTo(38, -0.4);
    mountainShape.closePath();
    const mountains = new THREE.Mesh(
      new THREE.ShapeGeometry(mountainShape),
      new THREE.MeshStandardMaterial({ color: 0x060a12, metalness: 0.04, roughness: 0.94, side: THREE.DoubleSide }),
    );
    mountains.position.set(0, 0, 58);
    mountains.name = 'Light trail mountain horizon';
    this.neonGroup.add(mountains);
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

  buildWeatherEffects() {
    this.buildRain();
    this.buildSnow();
  }

  buildRain() {
    const dropCount = 720;
    const positions = new Float32Array(dropCount * 6);
    const heads = new Float32Array(dropCount * 3);
    const speeds = new Float32Array(dropCount);
    const lengths = new Float32Array(dropCount);

    for (let index = 0; index < dropCount; index += 1) {
      const headOffset = index * 3;
      const lineOffset = index * 6;
      const x = -14 + seededRandom(index + 1100) * 28;
      const y = 0.3 + seededRandom(index + 1200) * 12;
      const z = -12 + seededRandom(index + 1300) * 24;
      const speed = 8.5 + seededRandom(index + 1400) * 8;
      const length = 0.22 + seededRandom(index + 1500) * 0.46;
      heads.set([x, y, z], headOffset);
      speeds[index] = speed;
      lengths[index] = length;
      positions.set([x, y, z, x + 0.09, y + length, z - 0.025], lineOffset);
    }

    const streakGeometry = new THREE.BufferGeometry();
    const streakAttribute = new THREE.BufferAttribute(positions, 3);
    streakAttribute.setUsage(THREE.DynamicDrawUsage);
    streakGeometry.setAttribute('position', streakAttribute);
    const streakMaterial = new THREE.LineBasicMaterial({
      color: 0xa9d9eb,
      depthWrite: false,
      opacity: 0.5,
      transparent: true,
    });
    this.rainStreaks = new THREE.LineSegments(streakGeometry, streakMaterial);
    this.rainStreaks.frustumCulled = false;

    const splashCount = 280;
    const splashPositions = new Float32Array(splashCount * 3);
    const splashAges = new Float32Array(splashCount);
    const splashLives = new Float32Array(splashCount);
    this.rainSplashes = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.024, 0.038, 12),
      new THREE.MeshBasicMaterial({
        color: 0xc7edff,
        depthWrite: false,
        opacity: 0.46,
        side: THREE.DoubleSide,
        transparent: true,
      }),
      splashCount,
    );
    this.rainSplashes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rainSplashes.frustumCulled = false;
    this.rainSplashDummy = new THREE.Object3D();

    this.rainRoot = new THREE.Group();
    this.rainRoot.name = 'Rain field';
    this.rainRoot.visible = false;
    this.rainRoot.add(this.rainStreaks, this.rainSplashes);
    this.dayGroup.add(this.rainRoot);
    this.rainState = {
      heads,
      lengths,
      positions,
      speeds,
      splashAges,
      splashLives,
      splashPositions,
    };

    for (let index = 0; index < splashCount; index += 1) {
      this.resetSplash(index, -seededRandom(index + 1600) * 0.5);
      this.updateSplashInstance(index);
    }
    this.rainSplashes.instanceMatrix.needsUpdate = true;
  }

  resetSplash(index, age = 0) {
    const state = this.rainState;
    const offset = index * 3;
    state.splashAges[index] = age;
    state.splashLives[index] = 0.36 + seededRandom(index * 7 + 1700 + age * 10) * 0.34;
    state.splashPositions[offset] = -8 + seededRandom(index * 11 + 1800 + age * 10) * 16;
    state.splashPositions[offset + 1] = 0.026;
    state.splashPositions[offset + 2] = -7 + seededRandom(index * 13 + 1900 + age * 10) * 14;
  }

  updateSplashInstance(index) {
    const state = this.rainState;
    const offset = index * 3;
    const progress = THREE.MathUtils.clamp(
      state.splashAges[index] / Math.max(state.splashLives[index], 0.001),
      0,
      1,
    );
    const pulse = Math.sin(progress * Math.PI);
    const scale = state.splashAges[index] < 0
      ? 0
      : (0.35 + progress * 1.65) * Math.pow(pulse, 0.35);
    this.rainSplashDummy.position.fromArray(state.splashPositions, offset);
    this.rainSplashDummy.scale.setScalar(scale);
    this.rainSplashDummy.rotation.set(-Math.PI / 2, 0, index * 0.91);
    this.rainSplashDummy.updateMatrix();
    this.rainSplashes.setMatrixAt(index, this.rainSplashDummy.matrix);
  }

  buildSnow() {
    const layerProfiles = [
      { color: 0xdceaf0, count: 480, drift: 0.14, opacity: 0.46, size: 0.01, speed: 0.55 },
      { color: 0xf0f7fa, count: 320, drift: 0.24, opacity: 0.68, size: 0.019, speed: 0.9 },
      { color: 0xffffff, count: 150, drift: 0.38, opacity: 0.86, size: 0.031, speed: 1.28 },
    ];

    this.snowLayers = layerProfiles.map((profile, layerIndex) => {
      const positions = new Float32Array(profile.count * 3);
      const fallSpeeds = new Float32Array(profile.count);
      const phases = new Float32Array(profile.count);
      const scales = new Float32Array(profile.count);
      for (let index = 0; index < profile.count; index += 1) {
        const offset = index * 3;
        const seed = layerIndex * 2000 + index;
        positions[offset] = -10 + seededRandom(seed + 2300) * 20;
        positions[offset + 1] = 0.12 + seededRandom(seed + 2400) * 9;
        positions[offset + 2] = -9 + seededRandom(seed + 2500) * 14.5;
        fallSpeeds[index] = profile.speed * (0.7 + seededRandom(seed + 2600) * 0.65);
        phases[index] = seededRandom(seed + 2700) * Math.PI * 2;
        scales[index] = 0.65 + seededRandom(seed + 2750) * 0.7;
      }

      const flakes = new THREE.InstancedMesh(
        new THREE.SphereGeometry(profile.size, 6, 4),
        new THREE.MeshBasicMaterial({
          color: profile.color,
          depthWrite: false,
          opacity: profile.opacity,
          transparent: true,
        }),
        profile.count,
      );
      const dummy = new THREE.Object3D();
      for (let index = 0; index < profile.count; index += 1) {
        dummy.position.fromArray(positions, index * 3);
        dummy.rotation.set(phases[index], phases[index] * 0.7, phases[index] * 0.4);
        dummy.scale.setScalar(scales[index]);
        dummy.updateMatrix();
        flakes.setMatrixAt(index, dummy.matrix);
      }
      flakes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      flakes.instanceMatrix.needsUpdate = true;
      flakes.name = `Snow layer ${layerIndex + 1}`;
      flakes.frustumCulled = false;
      flakes.visible = false;
      flakes.userData.weather = {
        ...profile,
        dummy,
        fallSpeeds,
        phases,
        positions,
        scales,
      };
      this.dayGroup.add(flakes);
      return flakes;
    });
  }

  updateRain(delta) {
    const state = this.rainState;
    const wind = -2.05;
    for (let index = 0; index < state.speeds.length; index += 1) {
      const headOffset = index * 3;
      const lineOffset = index * 6;
      let x = state.heads[headOffset] + wind * delta;
      let y = state.heads[headOffset + 1] - state.speeds[index] * delta;
      let z = state.heads[headOffset + 2] + 0.28 * delta;
      if (y < 0.02) {
        x = -14 + seededRandom(index + y * 100 + 2800) * 28;
        y = 8 + seededRandom(index + y * 100 + 2900) * 5;
        z = -12 + seededRandom(index + y * 100 + 3000) * 24;
      }
      if (x < -15) x = 15;
      if (z > 13) z = -13;
      state.heads.set([x, y, z], headOffset);
      const tailTime = state.lengths[index] / state.speeds[index];
      state.positions.set([
        x,
        y,
        z,
        x - wind * tailTime,
        y + state.lengths[index],
        z - 0.025,
      ], lineOffset);
    }
    this.rainStreaks.geometry.attributes.position.needsUpdate = true;

    for (let index = 0; index < state.splashAges.length; index += 1) {
      const wasDormant = state.splashAges[index] < 0;
      state.splashAges[index] += delta;
      if (state.splashAges[index] < 0) continue;
      if (wasDormant) {
        this.resetSplash(index, 0);
        this.updateSplashInstance(index);
        continue;
      }
      if (state.splashAges[index] > state.splashLives[index]) {
        this.resetSplash(index, -seededRandom(index + state.splashAges[index] * 3100) * 0.18);
        this.updateSplashInstance(index);
        continue;
      }
      this.updateSplashInstance(index);
    }
    this.rainSplashes.instanceMatrix.needsUpdate = true;
  }

  updateSnow(delta, elapsed) {
    this.snowLayers.forEach((layer, layerIndex) => {
      if (!layer.visible) return;
      const {
        count,
        drift,
        dummy,
        fallSpeeds,
        phases,
        positions,
        scales,
      } = layer.userData.weather;
      for (let index = 0; index < count; index += 1) {
        const offset = index * 3;
        const phase = phases[index];
        positions[offset] += Math.sin(elapsed * 0.72 + phase) * drift * delta;
        positions[offset + 1] -= fallSpeeds[index] * delta;
        positions[offset + 2] += Math.cos(elapsed * 0.48 + phase) * drift * 0.32 * delta;
        if (positions[offset + 1] < 0.04) {
          positions[offset] = -10 + seededRandom(index + elapsed * 100 + layerIndex * 3400) * 20;
          positions[offset + 1] = 8.2 + seededRandom(index + elapsed * 120 + layerIndex * 3500) * 1.8;
          positions[offset + 2] = -9 + seededRandom(index + elapsed * 140 + layerIndex * 3600) * 14.5;
        }
        if (positions[offset] > 11) positions[offset] = -11;
        else if (positions[offset] < -11) positions[offset] = 11;
        if (positions[offset + 2] > 6) positions[offset + 2] = -9;
        else if (positions[offset + 2] < -9) positions[offset + 2] = 6;
        const flutter = scales[index] * (0.82 + Math.sin(elapsed * 1.6 + phase) * 0.18);
        dummy.position.fromArray(positions, offset);
        dummy.rotation.set(
          elapsed * 0.42 + phase,
          elapsed * 0.31 + phase * 0.7,
          elapsed * 0.23 + phase * 0.4,
        );
        dummy.scale.setScalar(flutter);
        dummy.updateMatrix();
        layer.setMatrixAt(index, dummy.matrix);
      }
      layer.instanceMatrix.needsUpdate = true;
    });
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
      this.neonAreaLights[0].intensity = 6.8;
      this.neonAreaLights[1].intensity = 5.6;
      this.neonAreaLights[2].intensity = 4.4;
      this.neonAreaLights[3].intensity = 3.2;
    } else {
      this.stageKey.color.setHex(0xf0f4ff);
      this.stageAreaLights[0].intensity = 12;
      this.stageAreaLights[1].intensity = 9;
      this.stageAreaLights[2].intensity = 7;
    }
  }

  setWeather(weather) {
    this.weather = WEATHER_PROFILES[weather] ? weather : 'sunny';
    const showWeather = this.mode === 'day';
    if (this.rainRoot) this.rainRoot.visible = showWeather && this.weather === 'rain';
    this.snowLayers?.forEach((layer) => {
      layer.visible = showWeather && this.weather === 'snow';
    });
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
    this.dayGroundMaterial.clearcoat = profile.groundClearcoat ?? 0.24;
    this.dayGroundMaterial.clearcoatRoughness = profile.groundClearcoatRoughness ?? 0.42;
    this.dayGroundMaterial.envMapIntensity = profile.groundEnvironment ?? 1;
    this.dayGroundMaterial.roughness = profile.groundRoughness;
    this.dayReflection.visible = this.weather !== 'rain';
    this.dayShadowCatcher.visible = this.weather !== 'rain';
    if (this.dayReflection?.material?.isMeshPhysicalMaterial) {
      this.dayReflection.material.color.setHex(profile.reflectionColor ?? 0x526169);
      this.dayReflection.material.clearcoat = this.weather === 'rain' ? 1 : 0.86;
      this.dayReflection.material.clearcoatRoughness = this.weather === 'rain' ? 0.045 : 0.19;
      this.dayReflection.material.envMapIntensity = profile.reflectionEnvironment ?? 1.68;
      this.dayReflection.material.roughness = profile.reflectionRoughness ?? 0.24;
    }
  }

  setSunAngle(value) {
    const angle = THREE.MathUtils.lerp(-Math.PI * 0.18, Math.PI * 0.78, value);
    this.sun.position.set(Math.cos(angle) * 15, 6.5 + Math.sin(angle) * 12, 8.5);
  }

  update(delta, elapsed) {
    if (this.mode === 'neon') {
      this.neonStreaks.forEach((streak) => {
        streak.position.z -= streak.userData.speed * delta;
        if (streak.position.z < streak.userData.minZ) {
          streak.position.z += streak.userData.maxZ - streak.userData.minZ;
        }
        const pulse = 0.82 + Math.sin(elapsed * 3.4 + streak.userData.phase) * 0.18;
        streak.userData.trail.scale.y = streak.userData.baseScaleY * pulse;
      });
      this.neonRoadMarkers.forEach((marker) => {
        marker.position.z -= marker.userData.speed * delta;
        if (marker.position.z < marker.userData.minZ) {
          marker.position.z += marker.userData.maxZ - marker.userData.minZ;
        }
      });
      this.neonAreaLights.forEach((light, index) => {
        const span = 26;
        light.position.z = THREE.MathUtils.euclideanModulo(18 - elapsed * (9 + index * 2.3) + index * 8, span) - 13;
        const baseIntensity = [6.8, 5.6, 4.4, 3.2][index];
        light.intensity = baseIntensity * (0.86 + Math.sin(elapsed * 2.1 + index) * 0.14);
        light.lookAt(0, 0.72, 0);
      });
    }

    if (this.mode === 'stage') {
      this.stageRingMaterial.emissiveIntensity = 5.5 + Math.sin(elapsed * 1.45) * 0.55;
      this.stageRingMaterial.opacity = 0.78 + Math.sin(elapsed * 1.45) * 0.06;
    }

    if (this.rainRoot?.visible) this.updateRain(delta);
    if (this.snowLayers?.some((layer) => layer.visible)) this.updateSnow(delta, elapsed);
  }

  dispose() {
    this.neonSkyTexture?.dispose();
    [this.rainStreaks, this.rainSplashes, ...(this.snowLayers ?? [])].forEach((object) => {
      object?.geometry.dispose();
      object?.material.dispose();
      object?.removeFromParent();
    });
    this.rainRoot?.removeFromParent();
  }
}
