export const PAINTS = [
  { id: 'silver', nameKey: 'paint.silver', value: '#aeb6bd' },
  { id: 'graphite', nameKey: 'paint.graphite', value: '#34383d' },
  { id: 'obsidian', nameKey: 'paint.obsidian', value: '#111315' },
  { id: 'red', nameKey: 'paint.red', value: '#9d1718' },
  { id: 'purple', nameKey: 'paint.purple', value: '#683973' },
  { id: 'white', nameKey: 'paint.white', value: '#e6e8e6' },
];

export const CAMERA_VIEWS = [
  { id: 'hero', labelKey: 'camera.hero', position: [5.8, 2.35, 6.5], target: [0, 0.68, 0], fov: 33 },
  { id: 'front', labelKey: 'camera.front', position: [0, 1.15, 8.2], target: [0, 0.62, 0.35], fov: 31 },
  { id: 'side', labelKey: 'camera.side', position: [8.4, 1.42, 0.05], target: [0, 0.64, 0], fov: 31 },
  { id: 'rear', labelKey: 'camera.rear', position: [0, 1.35, -7.8], target: [0, 0.68, -0.2], fov: 32 },
  { id: 'top', labelKey: 'camera.top', position: [5.4, 7.1, 5.8], target: [0, 0.18, 0], fov: 35 },
  { id: 'interior', labelKey: 'camera.interior', position: [-0.2, 1.12, -0.2], target: [-0.08, 0.76, 2.85], fov: 64 },
  { id: 'wheel', labelKey: 'camera.wheel', position: [3.4, 0.7, 1.34], target: [0.82, 0.42, 1.28], fov: 29 },
];

export const WEATHER_PRESETS = [
  { id: 'sunny', nameKey: 'weather.sunny', detailKey: 'weather.sunnyDetail', value: '33.1℃', icon: 'sun' },
  { id: 'cloudy', nameKey: 'weather.cloudy', detailKey: 'weather.cloudyDetail', value: '16.8℃', icon: 'cloud' },
  { id: 'rain', nameKey: 'weather.rain', detailKey: 'weather.rainDetail', value: '21.4℃', icon: 'rain' },
  { id: 'snow', nameKey: 'weather.snow', detailKey: 'weather.snowDetail', value: '5.9℃', icon: 'snow' },
  { id: 'fog', nameKey: 'weather.fog', detailKey: 'weather.fogDetail', value: '24.5℃', icon: 'fog' },
];

export const SCENE_MODES = [
  { id: 'day', nameKey: 'scene.day', color: '#c7d6de' },
  { id: 'neon', nameKey: 'scene.neon', color: '#e728bd' },
  { id: 'stage', nameKey: 'scene.stage', color: '#b9914e' },
];

export const WHEEL_STYLES = [
  { id: 'multispoke', nameKey: 'wheel.multispoke' },
  { id: 'night', nameKey: 'wheel.night' },
];

export const DEFAULT_CONFIGURATION = {
  paint: PAINTS[0].value,
  wheel: WHEEL_STYLES[0].id,
  weather: WEATHER_PRESETS[0].id,
  scene: SCENE_MODES[0].id,
  view: CAMERA_VIEWS[0].id,
  lights: false,
  access: {
    leftDoor: false,
    rightDoor: false,
    trunk: false,
  },
  hotspots: false,
  autoRotate: false,
  timeOfDay: 0.78,
  sunAngle: 0.64,
  perspective: 0.52,
};
