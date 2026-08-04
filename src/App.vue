<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  Armchair,
  BatteryCharging,
  Camera,
  CarFront,
  ChevronRight,
  DoorOpen,
  Fan,
  Gauge,
  Lightbulb,
  Maximize,
  Navigation,
  Power,
  RadioTower,
  Settings2,
  ThermometerSun,
  Waves,
} from 'lucide-vue-next';
import { HmiScene } from './hmi/HmiScene.js';
import { CAMERA_VIEWS, MODES, PAINTS } from './hmi/config.js';

const viewport = ref(null);
const sceneReady = ref(false);
const webgpu = ref(true);
const activePanel = ref('exterior');
const stats = reactive({ speed: 0, power: 2.4, temperature: 21 });
const config = reactive({
  paint: PAINTS[0].value,
  wheel: 'aero',
  doors: false,
  lights: true,
  ambience: '#5ed6c7',
  mode: MODES[0],
  view: CAMERA_VIEWS[0].id,
  climate: true,
  massage: false,
});

let hmi;
let animationFrame;
const paintName = computed(() => PAINTS.find((paint) => paint.value === config.paint)?.name);

function selectView(view) {
  config.view = view;
  hmi?.setView(view);
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

function animateStats(time = 0) {
  stats.power = 2.4 + Math.sin(time * 0.0014) * 0.7;
  animationFrame = requestAnimationFrame(animateStats);
}

watch(() => config.paint, (value) => hmi?.setPaint(value));
watch(() => config.wheel, (value) => hmi?.setWheelStyle(value));
watch(() => config.doors, (value) => hmi?.setDoors(value));
watch(() => config.lights, (value) => hmi?.setLights(value));
watch(() => config.ambience, (value) => hmi?.setAmbience(value));
watch(() => config.mode, (value) => hmi?.setMode(value));

onMounted(() => {
  hmi = new HmiScene(viewport.value, ({ webgpu: supported }) => {
    webgpu.value = supported;
    sceneReady.value = true;
  });
  animationFrame = requestAnimationFrame(animateStats);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame);
  hmi?.dispose();
});
</script>

<template>
  <main class="hmi-shell">
    <div ref="viewport" class="scene-viewport" />

    <div class="scene-vignette" aria-hidden="true" />
    <div class="scan-line" aria-hidden="true" />

    <Transition name="loading">
      <div v-if="!sceneReady" class="loading-screen">
        <div class="loading-mark">N</div>
        <span>INITIALIZING WEBGPU</span>
        <i />
      </div>
    </Transition>

    <header class="topbar">
      <div class="brand-lockup">
        <span class="brand-mark">N</span>
        <div>
          <strong>NOVA</strong>
          <small>3D HMI / 01</small>
        </div>
      </div>

      <div class="system-state">
        <i />
        <span>{{ webgpu ? 'WEBGPU ACTIVE' : 'COMPATIBILITY MODE' }}</span>
        <b>12:48</b>
      </div>

      <nav class="top-actions" aria-label="系统操作">
        <button type="button" title="连接状态">
          <RadioTower :size="17" />
        </button>
        <button type="button" title="全屏" @click="toggleFullscreen">
          <Maximize :size="17" />
        </button>
        <button type="button" title="系统设置">
          <Settings2 :size="17" />
        </button>
      </nav>
    </header>

    <aside class="telemetry-panel" aria-label="车辆状态">
      <div class="panel-kicker">
        <span>VEHICLE STATUS</span>
        <i>LIVE</i>
      </div>

      <section class="speed-readout">
        <div>
          <strong>{{ String(stats.speed).padStart(3, '0') }}</strong>
          <span>km/h</span>
        </div>
        <small>P</small>
      </section>

      <div class="energy-line">
        <span :style="{ '--level': '86%' }" />
      </div>

      <dl class="primary-stats">
        <div>
          <dt><BatteryCharging :size="15" /> 电池</dt>
          <dd>86<small>%</small></dd>
        </div>
        <div>
          <dt><Navigation :size="15" /> 续航</dt>
          <dd>482<small>km</small></dd>
        </div>
        <div>
          <dt><Gauge :size="15" /> 功率</dt>
          <dd>{{ stats.power.toFixed(1) }}<small>kW</small></dd>
        </div>
      </dl>

      <section class="tire-status">
        <div class="mini-car" aria-hidden="true">
          <i /><i /><span /><i /><i />
        </div>
        <div class="tire-values">
          <span>2.5<small>bar</small></span>
          <span>2.5<small>bar</small></span>
          <span>2.6<small>bar</small></span>
          <span>2.6<small>bar</small></span>
        </div>
      </section>
    </aside>

    <aside class="config-panel" aria-label="车辆配置">
      <div class="config-title">
        <div>
          <span>CONFIGURATION</span>
          <strong>NOVA GT-X</strong>
        </div>
        <CarFront :size="26" />
      </div>

      <div class="panel-tabs" role="tablist">
        <button
          type="button"
          :class="{ active: activePanel === 'exterior' }"
          @click="activePanel = 'exterior'"
        >
          外观
        </button>
        <button
          type="button"
          :class="{ active: activePanel === 'interior' }"
          @click="activePanel = 'interior'"
        >
          座舱
        </button>
      </div>

      <template v-if="activePanel === 'exterior'">
        <section class="config-section paint-section">
          <header>
            <span>车身颜色</span>
            <strong>{{ paintName }}</strong>
          </header>
          <div class="swatches">
            <button
              v-for="paint in PAINTS"
              :key="paint.value"
              type="button"
              :title="paint.name"
              :aria-label="paint.name"
              :class="{ active: config.paint === paint.value }"
              :style="{ '--swatch': paint.value }"
              @click="config.paint = paint.value"
            />
          </div>
        </section>

        <section class="config-section">
          <header><span>轮毂</span><strong>{{ config.wheel === 'aero' ? 'AERO 21' : 'SPORT 22' }}</strong></header>
          <div class="option-row">
            <button type="button" :class="{ active: config.wheel === 'aero' }" @click="config.wheel = 'aero'">
              AERO 21
            </button>
            <button type="button" :class="{ active: config.wheel === 'sport' }" @click="config.wheel = 'sport'">
              SPORT 22
            </button>
          </div>
        </section>

        <section class="quick-controls">
          <button type="button" :class="{ active: config.doors }" @click="config.doors = !config.doors">
            <DoorOpen :size="18" />
            <span>迎宾</span>
            <i />
          </button>
          <button type="button" :class="{ active: config.lights }" @click="config.lights = !config.lights">
            <Lightbulb :size="18" />
            <span>灯光</span>
            <i />
          </button>
        </section>
      </template>

      <template v-else>
        <section class="climate-display">
          <div>
            <ThermometerSun :size="20" />
            <span>驾驶席</span>
          </div>
          <strong>{{ stats.temperature }}<sup>°</sup></strong>
          <div class="climate-scale"><i v-for="n in 8" :key="n" :class="{ active: n < 6 }" /></div>
        </section>

        <section class="quick-controls cabin-controls">
          <button type="button" :class="{ active: config.climate }" @click="config.climate = !config.climate">
            <Fan :size="18" />
            <span>空调</span>
            <i />
          </button>
          <button type="button" :class="{ active: config.massage }" @click="config.massage = !config.massage">
            <Armchair :size="18" />
            <span>舒享</span>
            <i />
          </button>
        </section>
      </template>

      <section class="config-section ambience-section">
        <header><span>场景氛围</span><strong>STUDIO</strong></header>
        <div class="ambience-options">
          <button
            v-for="color in ['#5ed6c7', '#e0a55d', '#7496e8', '#e4e7e8']"
            :key="color"
            type="button"
            :title="`氛围色 ${color}`"
            :aria-label="`氛围色 ${color}`"
            :style="{ '--ambience': color }"
            :class="{ active: config.ambience === color }"
            @click="config.ambience = color"
          />
        </div>
      </section>
    </aside>

    <div class="mode-switcher" aria-label="驾驶模式">
      <span>DRIVE MODE</span>
      <div>
        <button
          v-for="mode in MODES"
          :key="mode"
          type="button"
          :class="{ active: config.mode === mode }"
          @click="config.mode = mode"
        >
          {{ mode }}
        </button>
      </div>
    </div>

    <nav class="camera-dock" aria-label="镜头视角">
      <Camera :size="17" />
      <button
        v-for="(view, index) in CAMERA_VIEWS"
        :key="view.id"
        type="button"
        :class="{ active: config.view === view.id }"
        @click="selectView(view.id)"
      >
        <small>0{{ index + 1 }}</small>
        <span>{{ view.label }}</span>
      </button>
    </nav>

    <div class="power-badge">
      <Power :size="14" />
      <span>READY</span>
      <ChevronRight :size="14" />
    </div>

    <div class="sound-wave" aria-hidden="true">
      <Waves :size="17" />
      <i v-for="n in 12" :key="n" :style="{ '--i': n }" />
    </div>
  </main>
</template>
