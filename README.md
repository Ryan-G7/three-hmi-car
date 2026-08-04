# NOVA 3D HMI

Vue 3 and Three.js WebGPU automotive HMI concept based on the interaction language of UE automotive configurators.

## Run

```bash
npm install
npm run dev
```

The renderer uses WebGPU when available and falls back to Three.js' WebGL backend on unsupported browsers.

## Structure

- `src/App.vue`: UI state and controls
- `src/hmi/HmiScene.js`: WebGPU renderer, scene, model materials and animation
- `src/hmi/config.js`: paint, drive mode and camera configuration

## Model notice

The bundled `nova-gt.glb` and AO map originate from the Three.js `ferrari.glb` example asset and are included for prototype visualization. Review the upstream asset terms and replace the model with a properly licensed production vehicle asset before commercial use. The HMI brand, scene treatment and application code in this repository are original to this project.
