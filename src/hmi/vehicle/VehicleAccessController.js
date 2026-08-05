import * as THREE from 'three/webgpu';

function createDoorShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0.03, 0.28);
  shape.lineTo(1.42, 0.25);
  shape.lineTo(1.55, 0.48);
  shape.lineTo(1.3, 0.98);
  shape.lineTo(0.18, 1.03);
  shape.lineTo(0.03, 0.83);
  shape.closePath();
  return shape;
}

export class VehicleAccessController {
  constructor(parent, defaultPaint) {
    this._open = false;
    this.progress = 0;
    this.paintColor = new THREE.Color(defaultPaint);
    this.parts = [];
    this.root = new THREE.Group();
    this.root.name = 'Vehicle access animation';
    parent.add(this.root);
    this.build();
  }

  build() {
    const shape = createDoorShape();
    const doorGeometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      curveSegments: 24,
      depth: 0.045,
      steps: 1,
    });
    doorGeometry.computeVertexNormals();
    const doorMaskGeometry = new THREE.ShapeGeometry(shape, 24);

    const doorMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.055,
      color: this.paintColor,
      metalness: 0.78,
      opacity: 0,
      roughness: 0.18,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const holeMaterial = new THREE.MeshBasicMaterial({
      color: 0x040608,
      opacity: 0,
      side: THREE.DoubleSide,
      transparent: true,
    });

    [-1, 1].forEach((side) => {
      const hole = new THREE.Mesh(doorMaskGeometry, holeMaterial.clone());
      hole.position.set(side * 1.055, 0, 0.43);
      hole.rotation.y = side * Math.PI / 2;
      hole.scale.x = side;
      hole.renderOrder = 4;
      this.root.add(hole);

      const pivot = new THREE.Group();
      pivot.position.set(side * 1.075, 0, 0.43);
      const assembly = new THREE.Group();
      assembly.rotation.y = side * Math.PI / 2;
      assembly.scale.x = side;

      const panel = new THREE.Mesh(doorGeometry, doorMaterial.clone());
      panel.castShadow = true;
      const trim = new THREE.LineSegments(
        new THREE.EdgesGeometry(doorGeometry, 32),
        new THREE.LineBasicMaterial({ color: 0xe5edf0, opacity: 0, transparent: true }),
      );
      assembly.add(panel, trim);

      const detailParts = this.addDoorDetails(assembly, doorMaskGeometry);
      pivot.add(assembly);
      this.root.add(pivot);
      this.parts.push({ detailParts, hole, panel, pivot, side, trim, type: 'door' });
    });

    const trunk = new THREE.Mesh(
      new THREE.BoxGeometry(1.72, 0.07, 0.86, 8, 2, 8),
      doorMaterial.clone(),
    );
    trunk.position.set(0, 0.12, -0.42);
    trunk.castShadow = true;
    const trunkPivot = new THREE.Group();
    trunkPivot.position.set(0, 0.66, -1.42);
    trunkPivot.add(trunk);
    this.root.add(trunkPivot);
    this.parts.push({ panel: trunk, pivot: trunkPivot, side: 0, type: 'trunk' });
  }

  addDoorDetails(assembly, geometry) {
    const interiorMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x11161b,
      metalness: 0.12,
      opacity: 0,
      roughness: 0.64,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0xbec8cc,
      metalness: 0.9,
      opacity: 0,
      roughness: 0.18,
      transparent: true,
    });
    const speakerMaterial = new THREE.MeshStandardMaterial({
      color: 0x252c31,
      metalness: 0.7,
      opacity: 0,
      roughness: 0.38,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const parts = [];

    [-0.007, 0.052].forEach((depth) => {
      const inset = new THREE.Mesh(geometry, interiorMaterial.clone());
      inset.position.set(0.12, 0.13, depth);
      inset.scale.set(0.83, 0.74, 1);

      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.025), metalMaterial.clone());
      handle.position.set(0.35, 0.76, depth + (depth > 0 ? 0.012 : -0.012));
      handle.rotation.z = -0.06;

      const speaker = new THREE.Mesh(new THREE.CircleGeometry(0.14, 32), speakerMaterial.clone());
      speaker.position.set(1.13, 0.48, depth + (depth > 0 ? 0.014 : -0.014));
      if (depth < 0) speaker.rotation.y = Math.PI;

      assembly.add(inset, handle, speaker);
      parts.push(inset, handle, speaker);
    });

    return parts;
  }

  setPaint(color) {
    this.paintColor.set(color);
    this.parts.forEach(({ panel }) => {
      panel.material.color?.copy(this.paintColor);
    });
  }

  setOpen(open) {
    this._open = open;
  }

  get open() {
    return this._open;
  }

  update(delta) {
    this.progress = THREE.MathUtils.damp(this.progress, this._open ? 1 : 0, 5.7, delta);
    const eased = this.progress * this.progress * (3 - 2 * this.progress);

    this.parts.forEach(({ detailParts, hole, panel, pivot, side, trim, type }) => {
      if (type === 'door') {
        pivot.rotation.y = -side * eased * 0.82;
        hole.material.opacity = eased * 0.9;
        panel.material.opacity = eased * 0.98;
        trim.material.opacity = eased * 0.62;
        detailParts.forEach((part) => { part.material.opacity = eased * 0.98; });
      } else {
        pivot.rotation.x = -eased * 0.98;
        panel.material.opacity = eased;
      }
    });
  }
}
