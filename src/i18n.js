import { createI18n } from 'vue-i18n';

export const LOCALE_STORAGE_KEY = 'mercedes-hmi-locale';

const supportedLocales = ['zh-CN', 'en-US'];
const storedLocale = typeof window !== 'undefined'
  ? window.localStorage.getItem(LOCALE_STORAGE_KEY)
  : null;
const initialLocale = supportedLocales.includes(storedLocale) ? storedLocale : 'zh-CN';

const messages = {
  'zh-CN': {
    app: {
      brand: 'Mercedes-Benz 3D HMI',
      loading: '正在加载车辆与环境',
      range: '699km',
      temperature: '80°',
    },
    language: {
      chinese: '中文',
      english: 'EN',
      label: '语言',
    },
    panel: {
      access: '车门与尾门',
      camera: '镜头视角',
      close: '关闭面板',
      paint: '车身颜色',
      scene: '场景模式',
      vehicle: '外观配置',
      wheels: '轮毂',
    },
    tool: {
      access: '车门与后备箱',
      camera: '镜头视角',
      fullscreen: '全屏',
      hotspots: '交互热点',
      interior: '座舱视角',
      key: '车辆解锁',
      lights: '灯光',
      neon: '光轨模式',
      reset: '复位镜头',
      rotate: '自动环绕',
      scene: '场景',
      turntable: '旋转展台',
      vehicle: '外观配置',
      volume: '声音',
      wheels: '轮毂',
    },
    access: {
      closed: '已关闭',
      leftDoor: '左侧车门',
      opened: '已开启',
      rightDoor: '右侧车门',
      trunk: '后备箱',
    },
    control: {
      perspective: '透视大小',
      sunAngle: '太阳角度',
      timeOfDay: '昼夜变换',
    },
    paint: {
      graphite: '石墨灰',
      obsidian: '曜石黑',
      purple: '暮光紫',
      red: '炽焰红',
      silver: '曜岩银',
      white: '极地白',
    },
    camera: {
      front: '前脸',
      hero: '自由视角',
      interior: '座舱',
      rear: '尾部',
      side: '侧面',
      top: '俯视',
      wheel: '轮毂',
    },
    scene: {
      day: '湖畔广场',
      neon: '光轨空间',
      stage: '黑金展台',
    },
    wheel: {
      multispoke: 'AMG 多辐',
      night: 'AMG 夜色',
    },
    weather: {
      cloudy: '多云',
      cloudyDetail: '体感 17°',
      fog: '雾天',
      fogDetail: '能见度较低',
      rain: '雨天',
      rainDetail: '湿滑路面',
      snow: '小雪',
      snowDetail: '体感 6°',
      sunny: '晴天',
      sunnyDetail: '体感 33°',
    },
    toast: {
      partState: '{part}{state}',
      reset: '车辆与镜头已复位',
      unlocked: '车辆已解锁',
    },
    aria: {
      environment: '环境控制',
      settings: '{panel}设置',
      vehicleControls: '车辆控制',
    },
  },
  'en-US': {
    app: {
      brand: 'Mercedes-Benz 3D HMI',
      loading: 'Loading vehicle and environment',
      range: '699 km',
      temperature: '80°',
    },
    language: {
      chinese: '中文',
      english: 'EN',
      label: 'Language',
    },
    panel: {
      access: 'Doors & Trunk',
      camera: 'Camera Views',
      close: 'Close panel',
      paint: 'Body Color',
      scene: 'Scene Mode',
      vehicle: 'Exterior',
      wheels: 'Wheels',
    },
    tool: {
      access: 'Doors and trunk',
      camera: 'Camera views',
      fullscreen: 'Fullscreen',
      hotspots: 'Interaction hotspots',
      interior: 'Cockpit view',
      key: 'Unlock vehicle',
      lights: 'Lights',
      neon: 'Light trail mode',
      reset: 'Reset view',
      rotate: 'Auto orbit',
      scene: 'Scene',
      turntable: 'Turntable',
      vehicle: 'Exterior',
      volume: 'Sound',
      wheels: 'Wheels',
    },
    access: {
      closed: 'Closed',
      leftDoor: 'Left door',
      opened: 'Open',
      rightDoor: 'Right door',
      trunk: 'Trunk',
    },
    control: {
      perspective: 'Perspective',
      sunAngle: 'Sun Angle',
      timeOfDay: 'Time of Day',
    },
    paint: {
      graphite: 'Graphite Gray',
      obsidian: 'Obsidian Black',
      purple: 'Twilight Purple',
      red: 'Flame Red',
      silver: 'Rock Silver',
      white: 'Polar White',
    },
    camera: {
      front: 'Front',
      hero: 'Free View',
      interior: 'Cockpit',
      rear: 'Rear',
      side: 'Side',
      top: 'Top',
      wheel: 'Wheel',
    },
    scene: {
      day: 'Lakeside Plaza',
      neon: 'Light Trail',
      stage: 'Black Gold Stage',
    },
    wheel: {
      multispoke: 'AMG Multi-spoke',
      night: 'AMG Night',
    },
    weather: {
      cloudy: 'Cloudy',
      cloudyDetail: 'Feels like 17°',
      fog: 'Fog',
      fogDetail: 'Low visibility',
      rain: 'Rain',
      rainDetail: 'Wet surface',
      snow: 'Light Snow',
      snowDetail: 'Feels like 6°',
      sunny: 'Sunny',
      sunnyDetail: 'Feels like 33°',
    },
    toast: {
      partState: '{part} {state}',
      reset: 'Vehicle and camera reset',
      unlocked: 'Vehicle unlocked',
    },
    aria: {
      environment: 'Environment controls',
      settings: '{panel} settings',
      vehicleControls: 'Vehicle controls',
    },
  },
};

export const i18n = createI18n({
  fallbackLocale: 'en-US',
  legacy: false,
  locale: initialLocale,
  messages,
});
