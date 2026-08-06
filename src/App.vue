<script setup>
import { computed, markRaw, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { LOCALE_STORAGE_KEY } from './i18n.js';
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
  CloudRain,
  CloudSun,
  Disc3,
  DoorOpen,
  Focus,
  Hand,
  KeyRound,
  Languages,
  Leaf,
  Lightbulb,
  Maximize,
  Minimize2,
  Moon,
  Move3D,
  PanelsTopLeft,
  RotateCw,
  ScanLine,
  Settings,
  Signal,
  Snowflake,
  Sun,
  SunMedium,
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

const { locale, t } = useI18n();
const viewport = ref(null);
const sceneReady = ref(false);
const loadingProgress = ref(0);
const activePanel = ref(null);
const muted = ref(false);
const pathTracing = ref(false);
const pathTracingBusy = ref(false);
const toast = ref('');
const currentTime = ref(new Date());
const config = reactive({
  ...DEFAULT_CONFIGURATION,
  access: { ...DEFAULT_CONFIGURATION.access },
});

const weatherIcons = {
  cloud: markRaw(CloudSun),
  fog: markRaw(CloudFog),
  rain: markRaw(CloudRain),
  snow: markRaw(Snowflake),
  sun: markRaw(Sun),
};

const accessOptions = [
  { code: 'L', id: 'leftDoor', labelKey: 'access.leftDoor' },
  { code: 'R', id: 'rightDoor', labelKey: 'access.rightDoor' },
  { code: 'T', id: 'trunk', labelKey: 'access.trunk' },
];

const tools = [
  { id: 'lights', titleKey: 'tool.lights', icon: markRaw(Lightbulb) },
  { id: 'key', titleKey: 'tool.key', icon: markRaw(KeyRound) },
  { id: 'vehicle', titleKey: 'tool.vehicle', icon: markRaw(Car) },
  { id: 'access', titleKey: 'tool.access', icon: markRaw(DoorOpen) },
  { id: 'hotspots', titleKey: 'tool.hotspots', icon: markRaw(Hand) },
  { id: 'camera', titleKey: 'tool.camera', icon: markRaw(Focus) },
  { id: 'rotate', titleKey: 'tool.rotate', icon: markRaw(RotateCw) },
  { id: 'turntable', titleKey: 'tool.turntable', icon: markRaw(CircleDotDashed) },
  { id: 'scene', titleKey: 'tool.scene', icon: markRaw(PanelsTopLeft) },
  { id: 'interior', titleKey: 'tool.interior', icon: markRaw(Armchair) },
  { id: 'neon', titleKey: 'tool.neon', icon: markRaw(Clapperboard) },
  { id: 'pathTracing', titleKey: 'tool.pathTracing', icon: markRaw(ScanLine) },
  { id: 'wheels', titleKey: 'tool.wheels', icon: markRaw(Disc3) },
  { id: 'volume', titleKey: 'tool.volume', icon: markRaw(Volume2) },
  { id: 'fullscreen', titleKey: 'tool.fullscreen', icon: markRaw(Maximize) },
  { id: 'reset', titleKey: 'tool.reset', icon: markRaw(Minimize2) },
];

const anyAccessOpen = computed(() => Object.values(config.access).some(Boolean));
const paintName = computed(() => {
  const paint = PAINTS.find((item) => item.value === config.paint);
  return paint ? t(paint.nameKey) : '';
});
const sceneName = computed(() => {
  const scene = SCENE_MODES.find((item) => item.id === config.scene);
  return scene ? t(scene.nameKey) : '';
});
const panelTitle = computed(() => ({
  access: t('panel.access'),
  camera: t('panel.camera'),
  scene: t('panel.scene'),
  vehicle: t('panel.vehicle'),
}[activePanel.value] ?? t('panel.scene')));
const formattedTime = computed(() => {
  const values = [
    currentTime.value.getHours(),
    currentTime.value.getMinutes(),
    currentTime.value.getSeconds(),
  ];
  return values.map((value) => String(value).padStart(2, '0')).join(':');
});
const formattedDate = computed(() => new Intl.DateTimeFormat(locale.value, {
  day: 'numeric',
  month: 'numeric',
  weekday: 'long',
  year: 'numeric',
}).format(currentTime.value));

let hmi;
let clockTimer;
let toastTimer;

function syncSceneState() {
  hmi?.setPaint(config.paint);
  hmi?.setWheelStyle(config.wheel);
  hmi?.setLights(config.lights);
  hmi?.setAccessState(config.access);
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

function setLocale(nextLocale) {
  locale.value = nextLocale;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
}

function selectView(view, immediate = false) {
  config.view = view;
  hmi?.setView(view, immediate);
}

function selectScene(scene) {
  const previousScene = config.scene;
  config.scene = scene;
  config.autoRotate = scene === 'stage';
  if (scene !== 'day') config.lights = true;
  if (scene === 'neon') {
    config.view = 'rear';
    hmi?.setView('chase', true);
  } else if (previousScene === 'neon' && config.view === 'rear') {
    selectView('rear', true);
  }
  if (scene === 'stage') config.paint = PAINTS[4].value;
  if (scene === 'stage') selectView('hero');
}

function notifyAccess(part) {
  const option = accessOptions.find((item) => item.id === part);
  if (!option) return;
  const stateKey = config.access[part] ? 'access.opened' : 'access.closed';
  showToast(t('toast.partState', { part: t(option.labelKey), state: t(stateKey) }));
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

function isToolActive(id) {
  if (id === 'lights') return config.lights;
  if (id === 'access') return anyAccessOpen.value || activePanel.value === 'access';
  if (id === 'hotspots') return config.hotspots;
  if (id === 'rotate') return config.autoRotate;
  if (id === 'turntable') return config.scene === 'stage';
  if (id === 'neon') return config.scene === 'neon';
  if (id === 'pathTracing') return pathTracing.value;
  if (id === 'volume') return muted.value;
  return activePanel.value === id || (id === 'wheels' && activePanel.value === 'vehicle');
}

async function performTool(id) {
  if (id === 'lights') config.lights = !config.lights;
  if (id === 'key') showToast(t('toast.unlocked'));
  if (id === 'vehicle' || id === 'wheels') {
    activePanel.value = activePanel.value === 'vehicle' ? null : 'vehicle';
  }
  if (id === 'access') activePanel.value = activePanel.value === 'access' ? null : 'access';
  if (id === 'hotspots') config.hotspots = !config.hotspots;
  if (id === 'camera') activePanel.value = activePanel.value === 'camera' ? null : 'camera';
  if (id === 'rotate') config.autoRotate = !config.autoRotate;
  if (id === 'turntable') selectScene(config.scene === 'stage' ? 'day' : 'stage');
  if (id === 'scene') activePanel.value = activePanel.value === 'scene' ? null : 'scene';
  if (id === 'interior') selectView(config.view === 'interior' ? 'hero' : 'interior');
  if (id === 'neon') selectScene(config.scene === 'neon' ? 'day' : 'neon');
  if (id === 'pathTracing' && !pathTracingBusy.value) {
    const next = !pathTracing.value;
    pathTracing.value = next;
    pathTracingBusy.value = true;
    if (next) showToast(t('toast.pathTracingBuilding'));
    const enabled = await hmi?.setPathTracing(next);
    pathTracingBusy.value = false;
    if (next && enabled) showToast(t('toast.pathTracingOn'));
    else if (next) {
      pathTracing.value = false;
      showToast(t('toast.pathTracingUnavailable'));
    } else {
      showToast(t('toast.pathTracingOff'));
    }
  }
  if (id === 'volume') muted.value = !muted.value;
  if (id === 'fullscreen') toggleFullscreen();
  if (id === 'reset') {
    Object.keys(config.access).forEach((part) => { config.access[part] = false; });
    config.autoRotate = false;
    selectView('hero');
    showToast(t('toast.reset'));
  }
}

watch(() => config.paint, (value) => hmi?.setPaint(value));
watch(() => config.wheel, (value) => hmi?.setWheelStyle(value));
watch(() => config.lights, (value) => hmi?.setLights(value));
watch(() => ({ ...config.access }), (value) => hmi?.setAccessState(value));
watch(() => config.hotspots, (value) => hmi?.setHotspots(value));
watch(() => config.autoRotate, (value) => hmi?.setAutoRotate(value));
watch(() => config.weather, (value) => hmi?.setWeather(value));
watch(() => config.scene, (value) => hmi?.setSceneMode(value));
watch(() => config.timeOfDay, (value) => hmi?.setTimeOfDay(value));
watch(() => config.sunAngle, (value) => hmi?.setSunAngle(value));
watch(() => config.perspective, (value) => hmi?.setPerspective(value));
watch(locale, (value) => { document.documentElement.lang = value; }, { immediate: true });

onMounted(() => {
  hmi = new HmiScene(viewport.value, {
    onAccessChange: (result) => {
      if (!result?.state) return;
      Object.assign(config.access, result.state);
      notifyAccess(result.part);
    },
    onProgress: (progress) => { loadingProgress.value = progress; },
    onReady: () => {
      sceneReady.value = true;
      syncSceneState();
    },
  });
  clockTimer = window.setInterval(() => { currentTime.value = new Date(); }, 1000);
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
        <span>{{ t('app.brand') }}</span>
        <small>{{ t('app.loading') }}</small>
        <div class="loading-track"><i :style="{ width: `${Math.max(8, loadingProgress * 100)}%` }" /></div>
        <small>{{ Math.round(loadingProgress * 100) }}%</small>
      </section>
    </Transition>

    <template v-if="sceneReady">
      <header class="system-bar">
        <div class="system-left">
          <span class="brand-lockup"><CarFront :size="17" /> AMG HMI</span>
          <span><SunMedium :size="16" /> {{ t('app.temperature') }}</span>
          <span><Leaf :size="17" /></span>
          <span class="range"><BatteryFull :size="24" /> {{ t('app.range') }}</span>
        </div>
        <div class="system-right">
          <Settings :size="16" />
          <Signal :size="16" />
          <Wifi :size="16" />
          <div class="language-switch" role="group" :aria-label="t('language.label')">
            <Languages :size="14" />
            <button
              type="button"
              :class="{ active: locale === 'zh-CN' }"
              @click="setLocale('zh-CN')"
            >{{ t('language.chinese') }}</button>
            <button
              type="button"
              :class="{ active: locale === 'en-US' }"
              @click="setLocale('en-US')"
            >{{ t('language.english') }}</button>
          </div>
          <time>{{ formattedTime }}</time>
        </div>
      </header>

      <section class="time-readout">
        <time>{{ formattedTime }}</time>
        <span>{{ formattedDate }}</span>
      </section>

      <Transition name="panel">
        <aside v-if="activePanel" class="control-panel" :aria-label="t('aria.settings', { panel: panelTitle })">
          <header>
            <div>
              <small>Mercedes-Benz</small>
              <strong>{{ panelTitle }}</strong>
            </div>
            <button type="button" :title="t('panel.close')" @click="activePanel = null"><X :size="17" /></button>
          </header>

          <template v-if="activePanel === 'vehicle'">
            <section class="panel-section">
              <div class="section-heading"><span>{{ t('panel.paint') }}</span><b>{{ paintName }}</b></div>
              <div class="paint-swatches">
                <button
                  v-for="paint in PAINTS"
                  :key="paint.id"
                  type="button"
                  :aria-label="t(paint.nameKey)"
                  :title="t(paint.nameKey)"
                  :class="{ active: config.paint === paint.value }"
                  :style="{ '--paint': paint.value }"
                  @click="config.paint = paint.value"
                ><Check v-if="config.paint === paint.value" :size="13" /></button>
              </div>
            </section>
            <section class="panel-section">
              <div class="section-heading"><span>{{ t('panel.wheels') }}</span></div>
              <div class="wheel-options">
                <button
                  v-for="wheel in WHEEL_STYLES"
                  :key="wheel.id"
                  type="button"
                  :class="{ active: config.wheel === wheel.id }"
                  @click="config.wheel = wheel.id"
                >
                  <Disc3 :size="28" />
                  <span>{{ t(wheel.nameKey) }}</span>
                </button>
              </div>
            </section>
          </template>

          <div v-else-if="activePanel === 'access'" class="access-options">
            <label v-for="part in accessOptions" :key="part.id" class="access-switch-row">
              <span class="access-ident">
                <b>{{ part.code }}</b>
                <span>
                  <strong>{{ t(part.labelKey) }}</strong>
                  <small>{{ config.access[part.id] ? t('access.opened') : t('access.closed') }}</small>
                </span>
              </span>
              <span class="switch-control">
                <input
                  v-model="config.access[part.id]"
                  type="checkbox"
                  :aria-label="t(part.labelKey)"
                  @change="notifyAccess(part.id)"
                >
                <i><b /></i>
              </span>
            </label>
          </div>

          <div v-else-if="activePanel === 'camera'" class="camera-options">
            <button
              v-for="view in CAMERA_VIEWS"
              :key="view.id"
              type="button"
              :class="{ active: config.view === view.id }"
              @click="selectView(view.id)"
            >
              <Aperture :size="20" />
              <span>{{ t(view.labelKey) }}</span>
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
              <span>{{ t(scene.nameKey) }}</span>
            </button>
          </div>
        </aside>
      </Transition>

      <section class="environment-ribbon" :aria-label="t('aria.environment')">
        <button
          v-for="weather in WEATHER_PRESETS"
          :key="weather.id"
          type="button"
          class="weather-card"
          :class="{ active: config.weather === weather.id }"
          @click="config.weather = weather.id"
        >
          <span class="weather-icon"><component :is="weatherIcons[weather.icon]" :size="27" /></span>
          <span class="weather-copy"><strong>{{ weather.value }}</strong><small>{{ t(weather.nameKey) }} · {{ t(weather.detailKey) }}</small></span>
        </button>

        <label class="adjustment-card">
          <span><Moon :size="23" /></span>
          <span><b>{{ t('control.timeOfDay') }}</b><input v-model.number="config.timeOfDay" :aria-label="t('control.timeOfDay')" max="1" min="0" step="0.01" type="range"></span>
        </label>
        <label class="adjustment-card optional-card">
          <span><Move3D :size="23" /></span>
          <span><b>{{ t('control.perspective') }}</b><input v-model.number="config.perspective" :aria-label="t('control.perspective')" max="1" min="0" step="0.01" type="range"></span>
        </label>
        <label class="adjustment-card optional-card">
          <span><Sun :size="23" /></span>
          <span><b>{{ t('control.sunAngle') }}</b><input v-model.number="config.sunAngle" :aria-label="t('control.sunAngle')" max="1" min="0" step="0.01" type="range"></span>
        </label>
      </section>

      <nav class="command-dock" :aria-label="t('aria.vehicleControls')">
        <button
          v-for="tool in tools"
          :key="tool.id"
          type="button"
          :title="t(tool.titleKey)"
          :aria-label="t(tool.titleKey)"
          :class="{ active: isToolActive(tool.id) }"
          :disabled="tool.id === 'pathTracing' && pathTracingBusy"
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
  </main>
</template>
