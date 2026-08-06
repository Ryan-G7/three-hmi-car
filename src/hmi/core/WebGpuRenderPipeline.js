import * as THREE from 'three/webgpu';
import { emissive, mrt, output, pass, velocity } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';

const BLOOM_PROFILES = {
  day: { radius: 0.28, strength: 0.12, threshold: 1.45 },
  neon: { radius: 0.48, strength: 0.52, threshold: 0.92 },
  stage: { radius: 0.42, strength: 0.38, threshold: 0.92 },
};

export class WebGpuRenderPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.fallback = false;

    this.scenePass = pass(scene, camera);
    this.scenePass.setMRT(mrt({ output, emissive, velocity }));

    const colorTexture = this.scenePass.getTextureNode('output');
    const depthTexture = this.scenePass.getTextureNode('depth');
    const velocityTexture = this.scenePass.getTextureNode('velocity');
    const emissiveTexture = this.scenePass.getTextureNode('emissive');

    this.antialias = traa(colorTexture, depthTexture, velocityTexture, camera);
    this.glow = bloom(emissiveTexture, 0.12, 0.28, 1.45);
    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputNode = this.antialias.add(this.glow);
  }

  setMode(mode) {
    const profile = BLOOM_PROFILES[mode] ?? BLOOM_PROFILES.day;
    this.glow.strength.value = profile.strength;
    this.glow.radius.value = profile.radius;
    this.glow.threshold.value = profile.threshold;
  }

  render() {
    if (this.fallback) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    try {
      this.pipeline.render();
    } catch (error) {
      this.fallback = true;
      console.warn('Advanced render pipeline unavailable; using the direct renderer.', error);
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    this.glow?.dispose();
    this.antialias?.dispose();
    this.scenePass?.dispose();
    this.pipeline?.dispose();
  }
}
