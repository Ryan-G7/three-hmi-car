<script setup>
import { computed, markRaw, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  Aperture,
  Armchair,
  BatteryFull,
  Car,
  CarFront,
  Check,
  CircleDotDashed,
  Clapperboard,
  CloudFog,
  CloudSun,
  Disc3,
  DoorOpen,
  Focus,
  Hand,
  KeyRound,
  Leaf,
  Lightbulb,
  Maximize,
  Minimize2,
  Moon,
  Move3D,
  PanelsTopLeft,
  Power,
  RotateCw,
  Settings,
  Signal,
  Snowflake,
  Sun,
  SunMedium,
  UserCircle,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-vue-next';
import { HmiScene } from './hmi/HmiScene.js';
import {
  CAMERA_VIEWS,
  DEFAULT_CONFIGURATION,
  PAINTS,
  SCENE_MODES,
  WEATHER_PRESETS,
  WHEEL_STYLES,
} from './hmi/config.js';

const viewport = ref(null);
const sceneReady = ref(false);
const loadingProgress = ref(0);
const authenticated = ref(false);
const activePanel = ref(null);
const muted = ref(false);
const exitDialog = ref(false);
const toast = ref('');
const clockSeconds = ref(18 * 3600 + 14 * 60 + 25);
const loginForm = reactive({ account: '333', password: '333' });
const config = reactive({ ...DEFAULT_CONFIGURATION });

const weatherIcons = {
  cloud: markRaw(CloudSun),
  fog: markRaw(CloudFog),
  snow: markRaw(Snowflake),
  sun: markRaw(Sun),
};

const tools = [
  { id: 'lights', title: '灯光', icon: markRaw(Lightbulb) },
  { id: 'key', title: '车辆解锁', icon: markRaw(KeyRound) },
  { id: 'vehicle', title: '外观配置', icon: markRaw(Car) },
  { id: 'access', title: '车门与后备箱', icon: markRaw(DoorOpen) },
  { id: 'hotspots', title: '交互热点', icon: markRaw(Hand) },
  { id: 'camera', title: '镜头视角', icon: markRaw(Focus) },
  { id: 'rotate', title: '自动环绕', icon: markRaw(RotateCw) },
  { id: 'turntable', title: '旋转展台', icon: markRaw(CircleDotDashed) },
  { id: 'scene', title: '场景', icon: markRaw(PanelsTopLeft) },
  { id: 'interior', title: '座舱视角', icon: markRaw(Armchair) },
  { id: 'neon', title: '光轨模式', icon: markRaw(Clapperboard) },
  { id: 'wheels', title: '轮毂', icon: markRaw(Disc3) },
  { id: 'volume', title: '声音', icon: markRaw(Volume2) },
  { id: 'fullscreen', title: '全屏', icon: markRaw(Maximize) },
  { id: 'reset', title: '复位镜头', icon: markRaw(Minimize2) },
  { id: 'power', title: '退出', icon: markRaw(Power) },
];

const paintName = computed(() => PAINTS.find((paint) => paint.value === config.paint)?.name);
const sceneName = computed(() => SCENE_MODES.find((scene) => scene.id === config.scene)?.name);
const formattedTime = computed(() => {
  const hours = Math.floor(clockSeconds.value / 3600) % 24;
  const minutes = Math.floor(clockSeconds.value / 60) % 60;
  const seconds = clockSeconds.value % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
});

let hmi;
let clockTimer;
let toastTimer;

function syncSceneState() {
  hmi?.setPaint(config.paint);
  hmi?.setWheelStyle(config.wheel);
  hmi?.setLights(config.lights);
  hmi?.setAccessOpen(config.accessOpen);
  hmi?.setHotspots(config.hotspots);
  hmi?.setAutoRotate(config.autoRotate);
  hmi?.setWeather(config.weather);
  hmi?.setSceneMode(config.scene);
  hmi?.setTimeOfDay(config.timeOfDay);
  hmi?.setSunAngle(config.sunAngle);
  hmi?.setPerspective(config.perspective);
  hmi?.setView(config.view, true);
}

function showToast(message) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ''; }, 1800);
}

function authenticate() {
  authenticated.value = true;
  config.scene = 'day';
  config.view = 'hero';
  hmi?.setView('hero');
}

function selectView(view) {
  config.view = view;
  hmi?.setView(view);
}

function selectScene(scene) {
  config.scene = scene;
  config.autoRotate = scene === 'stage';
  if (scene !== 'day') config.lights = true;
  if (scene === 'stage') config.paint = PAINTS[4].value;
  if (scene === 'stage') selectView('hero');
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

function isToolActive(id) {
  if (id === 'lights') return config.lights;
  if (id === 'access') return config.accessOpen;
  if (id === 'hotspots') return config.hotspots;
  if (id === 'rotate') return config.autoRotate;
  if (id === 'turntable') return config.scene === 'stage';
  if (id === 'neon') return config.scene === 'neon';
  if (id === 'volume') return muted.value;
  return activePanel.value === id || (id === 'wheels' && activePanel.value === 'vehicle');
}

function performTool(id) {
  if (id === 'lights') config.lights = !config.lights;
  if (id === 'key') showToast('车辆已解锁');
  if (id === 'vehicle' || id === 'wheels') activePanel.value = activePanel.value === 'vehicle' ? null : 'vehicle';
  if (id === 'access') {
    config.accessOpen = !config.accessOpen;
    config.hotspots = true;
    showToast(config.accessOpen ? '车门与后备箱已开启' : '车门与后备箱已关闭');
  }
  if (id === 'hotspots') config.hotspots = !config.hotspots;
  if (id === 'camera') activePanel.value = activePanel.value === 'camera' ? null : 'camera';
  if (id === 'rotate') config.autoRotate = !config.autoRotate;
  if (id === 'turntable') selectScene(config.scene === 'stage' ? 'day' : 'stage');
  if (id === 'scene') activePanel.value = activePanel.value === 'scene' ? null : 'scene';
  if (id === 'interior') selectView(config.view === 'interior' ? 'hero' : 'interior');
  if (id === 'neon') selectScene(config.scene === 'neon' ? 'day' : 'neon');
  if (id === 'volume') muted.value = !muted.value;
  if (id === 'fullscreen') toggleFullscreen();
  if (id === 'reset') {
    config.accessOpen = false;
    config.autoRotate = false;
    selectView('hero');
  }
  if (id === 'power') exitDialog.value = true;
}

function exitExperience() {
  exitDialog.value = false;
  authenticated.value = false;
  activePanel.value = null;
  config.accessOpen = false;
  config.hotspots = false;
  config.autoRotate = false;
  selectScene('day');
  selectView('hero');
}

watch(() => config.paint, (value) => hmi?.setPaint(value));
watch(() => config.wheel, (value) => hmi?.setWheelStyle(value));
watch(() => config.lights, (value) => hmi?.setLights(value));
watch(() => config.accessOpen, (value) => hmi?.setAccessOpen(value));
watch(() => config.hotspots, (value) => hmi?.setHotspots(value));
watch(() => config.autoRotate, (value) => hmi?.setAutoRotate(value));
watch(() => config.weather, (value) => hmi?.setWeather(value));
watch(() => config.scene, (value) => hmi?.setSceneMode(value));
watch(() => config.timeOfDay, (value) => hmi?.setTimeOfDay(value));
watch(() => config.sunAngle, (value) => hmi?.setSunAngle(value));
watch(() => config.perspective, (value) => hmi?.setPerspective(value));

onMounted(() => {
  hmi = new HmiScene(viewport.value, {
    onAccessChange: (open) => {
      config.accessOpen = open;
      showToast(open ? '车辆已开启' : '车辆已关闭');
    },
    onProgress: (progress) => { loadingProgress.value = progress; },
    onReady: () => {
      sceneReady.value = true;
      syncSceneState();
    },
  });
  clockTimer = window.setInterval(() => { clockSeconds.value += 1; }, 1000);
});

onBeforeUnmount(() => {
  clearInterval(clockTimer);
  clearTimeout(toastTimer);
  hmi?.dispose();
});
</script>

<template>
  <main class="hmi-shell">
    <div ref="viewport" class="scene-viewport" />
    <div class="scene-grade" :class="`scene-grade--${config.scene}`" aria-hidden="true" />

    <Transition name="loading">
      <section v-if="!sceneReady" class="loading-screen" aria-live="polite">
        <div class="mercedes-mark">◆</div>
        <span>Mercedes-Benz 3D HMI</span>
        <div class="loading-track"><i :style="{ width: `${Math.max(8, loadingProgress * 100)}%` }" /></div>
        <small>{{ Math.round(loadingProgress * 100) }}%</small>
      </section>
    </Transition>

    <Transition name="login">
      <section v-if="sceneReady && !authenticated" class="login-screen">
        <form class="login-panel" @submit.prevent="authenticate">
          <header>登录</header>
          <label>
            <UserCircle :size="16" />
            <input v-model="loginForm.account" aria-label="账号" autocomplete="username" placeholder="请输入账号">
          </label>
          <label>
            <KeyRound :size="16" />
            <input v-model="loginForm.password" aria-label="密码" autocomplete="current-password" placeholder="请输入密码" type="password">
          </label>
          <button class="register-link" type="button">注册</button>
          <button class="login-submit" type="submit">登录</button>
        </form>
        <button class="login-power" type="button" title="关闭" @click="exitDialog = true">
          <Power :size="34" />
        </button>
      </section>
    </Transition>

    <template v-if="sceneReady && authenticated">
      <header class="system-bar">
        <div class="system-left">
          <span><UserCircle :size="17" /> 登录</span>
          <span><SunMedium :size="16" /> 80°</span>
          <span><Leaf :size="17" /></span>
          <span class="range"><BatteryFull :size="24" /> 699km</span>
        </div>
        <div class="system-right">
          <Settings :size="16" />
          <Signal :size="16" />
          <Wifi :size="16" />
          <time>{{ formattedTime }}</time>
        </div>
      </header>

      <section class="time-readout">
        <time>{{ formattedTime }}</time>
        <span>2025.1.4&nbsp;&nbsp;星期六</span>
      </section>

      <Transition name="panel">
        <aside v-if="activePanel" class="control-panel" :aria-label="`${activePanel} 设置`">
          <header>
            <div>
              <small>Mercedes-Benz</small>
              <strong v-if="activePanel === 'vehicle'">外观配置</strong>
              <strong v-else-if="activePanel === 'camera'">镜头视角</strong>
              <strong v-else>场景模式</strong>
            </div>
            <button type="button" title="关闭面板" @click="activePanel = null"><X :size="17" /></button>
          </header>

          <template v-if="activePanel === 'vehicle'">
            <section class="panel-section">
              <div class="section-heading"><span>车身颜色</span><b>{{ paintName }}</b></div>
              <div class="paint-swatches">
                <button
                  v-for="paint in PAINTS"
                  :key="paint.id"
                  type="button"
                  :aria-label="paint.name"
                  :title="paint.name"
                  :class="{ active: config.paint === paint.value }"
                  :style="{ '--paint': paint.value }"
                  @click="config.paint = paint.value"
                ><Check v-if="config.paint === paint.value" :size="13" /></button>
              </div>
            </section>
            <section class="panel-section">
              <div class="section-heading"><span>轮毂</span></div>
              <div class="wheel-options">
                <button
                  v-for="wheel in WHEEL_STYLES"
                  :key="wheel.id"
                  type="button"
                  :class="{ active: config.wheel === wheel.id }"
                  @click="config.wheel = wheel.id"
                >
                  <Disc3 :size="28" />
                  <span>{{ wheel.name }}</span>
                </button>
              </div>
            </section>
          </template>

          <div v-else-if="activePanel === 'camera'" class="camera-options">
            <button
              v-for="view in CAMERA_VIEWS"
              :key="view.id"
              type="button"
              :class="{ active: config.view === view.id }"
              @click="selectView(view.id)"
            >
              <Aperture :size="20" />
              <span>{{ view.label }}</span>
            </button>
          </div>

          <div v-else class="scene-options">
            <button
              v-for="scene in SCENE_MODES"
              :key="scene.id"
              type="button"
              :class="{ active: config.scene === scene.id }"
              :style="{ '--scene-color': scene.color }"
              @click="selectScene(scene.id)"
            >
              <i />
              <span>{{ scene.name }}</span>
            </button>
          </div>
        </aside>
      </Transition>

      <section class="environment-ribbon" aria-label="环境控制">
        <button
          v-for="weather in WEATHER_PRESETS"
          :key="weather.id"
          type="button"
          class="weather-card"
          :class="{ active: config.weather === weather.id }"
          @click="config.weather = weather.id"
        >
          <span class="weather-icon"><component :is="weatherIcons[weather.icon]" :size="27" /></span>
          <span class="weather-copy"><strong>{{ weather.value }}</strong><small>{{ weather.name }} · {{ weather.detail }}</small></span>
        </button>

        <label class="adjustment-card">
          <span><Moon :size="23" /></span>
          <span><b>昼夜变换</b><input v-model.number="config.timeOfDay" aria-label="昼夜变换" max="1" min="0" step="0.01" type="range"></span>
        </label>
        <label class="adjustment-card optional-card">
          <span><Move3D :size="23" /></span>
          <span><b>透视大小</b><input v-model.number="config.perspective" aria-label="透视大小" max="1" min="0" step="0.01" type="range"></span>
        </label>
        <label class="adjustment-card optional-card">
          <span><Sun :size="23" /></span>
          <span><b>太阳角度</b><input v-model.number="config.sunAngle" aria-label="太阳角度" max="1" min="0" step="0.01" type="range"></span>
        </label>
      </section>

      <nav class="command-dock" aria-label="车辆控制">
        <button
          v-for="tool in tools"
          :key="tool.id"
          type="button"
          :title="tool.title"
          :aria-label="tool.title"
          :class="{ active: isToolActive(tool.id), danger: tool.id === 'power' }"
          @click="performTool(tool.id)"
        >
          <VolumeX v-if="tool.id === 'volume' && muted" :size="24" />
          <component :is="tool.icon" v-else :size="24" />
        </button>
      </nav>

      <div class="scene-label">
        <CarFront :size="15" />
        <span>AMG GT BLACK SERIES</span>
        <i />
        <b>{{ sceneName }}</b>
      </div>

      <Transition name="toast">
        <div v-if="toast" class="status-toast">{{ toast }}</div>
      </Transition>
    </template>

    <Transition name="modal">
      <div v-if="exitDialog" class="modal-backdrop" @click.self="exitDialog = false">
        <section class="exit-dialog" role="dialog" aria-modal="true" aria-label="退出项目">
          <strong>是否退出项目</strong>
          <div>
            <button type="button" @click="exitExperience">是</button>
            <button type="button" @click="exitDialog = false">否</button>
          </div>
        </section>
      </div>
    </Transition>
  </main>
</template>
