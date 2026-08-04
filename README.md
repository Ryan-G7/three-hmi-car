# Three.js WebGPU Automotive HMI

Vue 3 and Three.js r185 automotive HMI configurator inspired by the interaction language of Unreal Engine vehicle experiences.

## Run

```bash
npm install
npm run dev
```

The primary rendering path uses `WebGPURenderer`, HDR image-based lighting, native r185 TRAA, restrained node-based bloom, responsive camera framing, and three switchable environments. `WebGPURenderer` automatically falls back to its WebGL2 backend on devices without WebGPU.

## Structure

- `src/App.vue`: application state and responsive HMI controls
- `src/hmi/HmiScene.js`: lifecycle, camera, input, and subsystem coordination
- `src/hmi/core/AssetRepository.js`: cached HDR and glTF loading
- `src/hmi/core/WebGpuRenderPipeline.js`: WebGPU MRT, TRAA, and bloom pipeline
- `src/hmi/VehicleRig.js`: vehicle subsystem orchestration
- `src/hmi/vehicle/`: vehicle materials, lights, access animation, and hotspots
- `src/hmi/EnvironmentRig.js`: environment assets, weather, surfaces, and lighting
- `src/hmi/environment/profiles.js`: weather and scene lighting profiles
- `src/hmi/config.js`: paint, wheel, weather, environment, and camera presets

## Model notice

The active `mercedes-benz_amg.glb` asset is "Mercedes-Benz AMG GT Black Series" by Tiaan Pretorius and is licensed under CC BY-NC 4.0. Its source URL and attribution are embedded in the GLB metadata. The fallback `nova-gt.glb` and AO map originate from the Three.js `ferrari.glb` example asset. Review all upstream terms and replace the model with a production-licensed asset before commercial use.

The `cayley_lookout_2k.hdr` environment is from [Poly Haven](https://polyhaven.com/) and is licensed under CC0. The complete commercial building is from Kenney's City Kit (Commercial) 2.1 and is also licensed under CC0; its license is included beside the model.
