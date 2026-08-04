# THREE 3D HMI

Vue 3 and Three.js automotive HMI configurator inspired by the interaction language of Unreal Engine vehicle experiences.

## Run

```bash
npm install
npm run dev
```

The experience uses a physically lit WebGL scene with bloom, real-time reflections, responsive camera framing, and three switchable environments.

## Structure

- `src/App.vue`: application state and responsive HMI controls
- `src/hmi/HmiScene.js`: renderer, camera, post-processing, and interaction coordination
- `src/hmi/VehicleRig.js`: vehicle loading, materials, lights, access animation, and hotspots
- `src/hmi/EnvironmentRig.js`: lake plaza, neon track, showroom, weather, and lighting
- `src/hmi/config.js`: paint, wheel, weather, environment, and camera presets

## Model notice

The active `mercedes-benz_amg.glb` asset is "Mercedes-Benz AMG GT Black Series" by Tiaan Pretorius and is licensed under CC BY-NC 4.0. Its source URL and attribution are embedded in the GLB metadata. The fallback `nova-gt.glb` and AO map originate from the Three.js `ferrari.glb` example asset. Review all upstream terms and replace the model with a production-licensed asset before commercial use.

The Himalayan panorama is adapted from [Panorama of Himalayas from Ranikhet, Uttarakhand, India](https://commons.wikimedia.org/wiki/File:Panorama_of_Himalayas_from_Ranikhet,_Uttarakhand,_India.jpg), original by Harshit SR and derivative by UnpetitproleX, licensed under CC BY-SA 4.0.
