export const PAINTS = [
  { id: 'silver', name: '曜岩银', value: '#aeb6bd' },
  { id: 'graphite', name: '石墨灰', value: '#34383d' },
  { id: 'obsidian', name: '曜石黑', value: '#111315' },
  { id: 'red', name: '炽焰红', value: '#9d1718' },
  { id: 'purple', name: '暮光紫', value: '#683973' },
  { id: 'white', name: '极地白', value: '#e6e8e6' },
];

export const CAMERA_VIEWS = [
  { id: 'hero', label: '自由视角', position: [5.8, 2.35, 6.5], target: [0, 0.68, 0], fov: 33 },
  { id: 'front', label: '前脸', position: [0, 1.15, 8.2], target: [0, 0.62, 0.35], fov: 31 },
  { id: 'side', label: '侧面', position: [8.4, 1.42, 0.05], target: [0, 0.64, 0], fov: 31 },
  { id: 'rear', label: '尾部', position: [0, 1.35, -7.8], target: [0, 0.68, -0.2], fov: 32 },
  { id: 'top', label: '俯视', position: [5.4, 7.1, 5.8], target: [0, 0.18, 0], fov: 35 },
  { id: 'interior', label: '座舱', position: [-0.2, 1.12, -0.2], target: [-0.08, 0.76, 2.85], fov: 64 },
  { id: 'wheel', label: '轮毂', position: [3.4, 0.7, 1.34], target: [0.82, 0.42, 1.28], fov: 29 },
];

export const WEATHER_PRESETS = [
  { id: 'sunny', name: '晴天', detail: '华氏 90°', value: '33.1℃', icon: 'sun' },
  { id: 'cloudy', name: '多云', detail: '体感 62°', value: '16.8℃', icon: 'cloud' },
  { id: 'snow', name: '小雪', detail: '体感 43°', value: '5.9℃', icon: 'snow' },
  { id: 'fog', name: '多云', detail: '华氏 76°', value: '24.5℃', icon: 'fog' },
];

export const SCENE_MODES = [
  { id: 'day', name: '湖畔广场', color: '#c7d6de' },
  { id: 'neon', name: '光轨空间', color: '#e728bd' },
  { id: 'stage', name: '黑金展台', color: '#b9914e' },
];

export const WHEEL_STYLES = [
  { id: 'multispoke', name: 'AMG 多辐' },
  { id: 'night', name: 'AMG 夜色' },
];

export const DEFAULT_CONFIGURATION = {
  paint: PAINTS[0].value,
  wheel: WHEEL_STYLES[0].id,
  weather: WEATHER_PRESETS[0].id,
  scene: SCENE_MODES[0].id,
  view: CAMERA_VIEWS[0].id,
  lights: false,
  accessOpen: false,
  hotspots: false,
  autoRotate: false,
  timeOfDay: 0.78,
  sunAngle: 0.64,
  perspective: 0.52,
};
