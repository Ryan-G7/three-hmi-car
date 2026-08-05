import * as THREE from 'three/webgpu';

function createHotspotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 160, 160);

  const glow = context.createRadialGradient(80, 80, 14, 80, 80, 74);
  glow.addColorStop(0, 'rgba(233, 249, 255, .44)');
  glow.addColorStop(0.5, 'rgba(61, 181, 255, .16)');
  glow.addColorStop(1, 'rgba(61, 181, 255, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 160, 160);

  context.beginPath();
  context.arc(80, 80, 43, 0, Math.PI * 2);
  context.fillStyle = 'rgba(5, 12, 18, .72)';
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = 'rgba(221, 244, 255, .95)';
  context.stroke();

  context.beginPath();
  context.arc(80, 80, 11, 0, Math.PI * 2);
  context.fillStyle = '#eaf8ff';
  context.fill();
  return new THREE.CanvasTexture(canvas);
}

const HOTSPOTS = [
  { id: 'left-door', position: [-1.22, 0.84, -0.35] },
  { id: 'right-door', position: [1.22, 0.84, -0.35] },
  { id: 'trunk', position: [0, 0.76, -2.42] },
  { id: 'hood', position: [0, 0.76, 2.25] },
];

export class VehicleHotspots {
  constructor(parent) {
    this.visible = false;
    this.texture = createHotspotTexture();
    this.root = new THREE.Group();
    this.root.name = 'Vehicle hotspots';
    parent.add(this.root);

    this.markers = HOTSPOTS.map(({ id, position }) => {
      const material = new THREE.SpriteMaterial({
        depthTest: false,
        depthWrite: false,
        map: this.texture,
        transparent: true,
      });
      material.toneMapped = false;
      const marker = new THREE.Sprite(material);
      marker.name = `hotspot-${id}`;
      marker.position.set(...position);
      marker.scale.setScalar(0.27);
      marker.visible = false;
      marker.userData.action = id;
      marker.renderOrder = 20;
      this.root.add(marker);
      return marker;
    });
  }

  setVisible(visible) {
    this.visible = visible;
    this.markers.forEach((marker) => { marker.visible = visible; });
  }

  hitTest(raycaster) {
    if (!this.visible) return null;
    return raycaster.intersectObjects(this.markers, false)[0]?.object.userData.action ?? null;
  }

  update(elapsed) {
    if (!this.visible) return;
    this.markers.forEach((marker, index) => {
      const scale = 0.27 + Math.sin(elapsed * 2.35 + index * 0.8) * 0.022;
      marker.scale.setScalar(scale);
      marker.material.opacity = 0.9 + Math.sin(elapsed * 2.35 + index) * 0.08;
    });
  }

  dispose() {
    this.markers.forEach((marker) => marker.material.dispose());
    this.texture.dispose();
    this.root.removeFromParent();
  }
}
