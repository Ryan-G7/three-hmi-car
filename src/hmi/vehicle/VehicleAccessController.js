import * as THREE from 'three/webgpu';

const ACCESS_PARTS = ['leftDoor', 'rightDoor', 'trunk'];

function createIndexedGeometry(source, indices) {
  if (!indices.length) return null;
  const geometry = source.clone();
  const IndexArray = source.index?.array.constructor ?? Uint32Array;
  geometry.setIndex(new THREE.BufferAttribute(new IndexArray(indices), 1));
  geometry.clearGroups();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function replaceSourceGeometry(mesh, source, remaining) {
  const replacement = createIndexedGeometry(source, remaining);
  if (!replacement) {
    mesh.visible = false;
    return;
  }
  mesh.geometry = replacement;
  source.dispose();
}

function splitTriangles(mesh, classifyTriangle) {
  const source = mesh.geometry;
  const position = source.getAttribute('position');
  const sourceIndex = source.index?.array;
  if (!position) return new Map();
  const indexCount = sourceIndex?.length ?? position.count;

  const groups = new Map();
  const remaining = [];
  const centroid = new THREE.Vector3();

  for (let offset = 0; offset < indexCount; offset += 3) {
    const a = sourceIndex?.[offset] ?? offset;
    const b = sourceIndex?.[offset + 1] ?? offset + 1;
    const c = sourceIndex?.[offset + 2] ?? offset + 2;
    centroid.set(
      (position.getX(a) + position.getX(b) + position.getX(c)) / 3,
      (position.getY(a) + position.getY(b) + position.getY(c)) / 3,
      (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3,
    );
    const group = classifyTriangle(centroid);
    const destination = group
      ? (groups.get(group) ?? groups.set(group, []).get(group))
      : remaining;
    destination.push(a, b, c);
  }

  const result = new Map();
  groups.forEach((indices, id) => {
    const geometry = createIndexedGeometry(source, indices);
    if (geometry) result.set(id, geometry);
  });
  replaceSourceGeometry(mesh, source, remaining);
  return result;
}

function splitConnectedComponents(mesh, classifyComponent, weldVertices = false) {
  const source = mesh.geometry;
  const position = source.getAttribute('position');
  const sourceIndex = source.index?.array;
  if (!position || !sourceIndex) return new Map();

  const parent = new Int32Array(position.count);
  const rank = new Uint8Array(position.count);
  for (let index = 0; index < parent.length; index += 1) parent[index] = index;

  const find = (value) => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  };
  const union = (left, right) => {
    let a = find(left);
    let b = find(right);
    if (a === b) return;
    if (rank[a] < rank[b]) [a, b] = [b, a];
    parent[b] = a;
    if (rank[a] === rank[b]) rank[a] += 1;
  };

  for (let offset = 0; offset < sourceIndex.length; offset += 3) {
    union(sourceIndex[offset], sourceIndex[offset + 1]);
    union(sourceIndex[offset], sourceIndex[offset + 2]);
  }

  if (weldVertices) {
    const welded = new Map();
    for (let index = 0; index < position.count; index += 1) {
      const key = `${Math.round(position.getX(index) * 1e5)},${Math.round(position.getY(index) * 1e5)},${Math.round(position.getZ(index) * 1e5)}`;
      const match = welded.get(key);
      if (match === undefined) welded.set(key, index);
      else union(index, match);
    }
  }

  const components = new Map();
  const point = new THREE.Vector3();
  for (let offset = 0; offset < sourceIndex.length; offset += 3) {
    const root = find(sourceIndex[offset]);
    const component = components.get(root) ?? { bounds: new THREE.Box3(), indices: [] };
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = sourceIndex[offset + corner];
      component.indices.push(vertex);
      point.fromBufferAttribute(position, vertex);
      component.bounds.expandByPoint(point);
    }
    components.set(root, component);
  }

  const groups = new Map();
  const remaining = [];
  components.forEach(({ bounds, indices }) => {
    const group = classifyComponent(bounds);
    const destination = group
      ? (groups.get(group) ?? groups.set(group, []).get(group))
      : remaining;
    destination.push(...indices);
  });

  const result = new Map();
  groups.forEach((indices, id) => {
    const geometry = createIndexedGeometry(source, indices);
    if (geometry) result.set(id, geometry);
  });
  replaceSourceGeometry(mesh, source, remaining);
  return result;
}

function findMesh(root, pattern) {
  let match = null;
  root.traverse((object) => {
    if (!match && object.isMesh && pattern.test(object.name)) match = object;
  });
  return match;
}

function classifyDoorPanel(bounds) {
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const side = center.x < 0 ? 'leftDoor' : 'rightDoor';
  const isMainPanel = Math.abs(center.x) > 0.75
    && size.y > 0.48
    && size.z > 1.05
    && bounds.min.z > -1
    && bounds.max.z < 0.45;
  const isHandle = Math.abs(center.x) > 0.88
    && bounds.min.y > 0.62
    && bounds.min.z > -0.8
    && bounds.max.z < -0.44;
  return isMainPanel || isHandle ? side : null;
}

function classifyDoorWindow(point) {
  if (Math.abs(point.x) < 0.58
    || point.y < 0.7
    || point.z < -0.95
    || point.z > 0.14) return null;
  return point.x < 0 ? 'leftDoor' : 'rightDoor';
}

function classifyRearWindow(point) {
  return point.y > 0.7 && point.z < -0.92 && Math.abs(point.x) < 0.83
    ? 'trunk'
    : null;
}

function classifyTrunkCarbon(bounds) {
  const center = bounds.getCenter(new THREE.Vector3());
  return center.z < -1.48
    && center.y > 0.74
    && bounds.max.y > 0.78
    && bounds.min.z < -1.65
    ? 'trunk'
    : null;
}

export class VehicleAccessController {
  constructor(asset) {
    this.asset = asset;
    this.state = { leftDoor: false, rightDoor: false, trunk: false };
    this.progress = { leftDoor: 0, rightDoor: 0, trunk: 0 };
    this.asset.updateWorldMatrix(true, true);
    this.root = asset.parent ?? asset;
    this.parts = {
      leftDoor: this.createPart('leftDoor', [-0.94, 0, 0.37]),
      rightDoor: this.createPart('rightDoor', [0.94, 0, 0.37]),
      trunk: this.createPart('trunk', [0, 1.02, -1.16]),
    };
    this.extractOriginalParts();
    this.root.updateMatrixWorld(true);
  }

  createPart(id, pivotPosition) {
    const pivot = new THREE.Group();
    pivot.name = `Original vehicle ${id} pivot`;
    pivot.position.fromArray(pivotPosition);
    this.root.add(pivot);
    return { pivot };
  }

  addGeometry(partId, source, geometry) {
    if (!geometry) return;
    const sourceToRoot = new THREE.Matrix4().multiplyMatrices(
      this.root.matrixWorld.clone().invert(),
      source.matrixWorld,
    );
    geometry.applyMatrix4(sourceToRoot);
    const part = new THREE.Mesh(geometry, source.material);
    part.name = `${source.name} ${partId}`;
    part.castShadow = source.castShadow;
    part.receiveShadow = source.receiveShadow;
    part.frustumCulled = source.frustumCulled;
    part.renderOrder = source.renderOrder;
    part.position.copy(this.parts[partId].pivot.position).multiplyScalar(-1);
    this.parts[partId].pivot.add(part);
  }

  addSplitGeometry(source, split) {
    split.forEach((geometry, partId) => this.addGeometry(partId, source, geometry));
  }

  extractOriginalParts() {
    const body = findMesh(this.asset, /^M_CarPaint_Max_M_CarPaint_Max_0$/);
    const windows = findMesh(this.asset, /^M_Glass_WindowFront_Max002_Window_0$/);
    const carbon = findMesh(this.asset, /^M__Carbon_Gloss_Carbon_0$/);

    if (body) {
      this.addSplitGeometry(body, splitConnectedComponents(body, classifyDoorPanel));
    }

    if (windows) {
      this.addSplitGeometry(windows, splitTriangles(windows, classifyDoorWindow));
      this.addSplitGeometry(windows, splitTriangles(windows, classifyRearWindow));
    }

    if (carbon) {
      this.addSplitGeometry(
        carbon,
        splitConnectedComponents(carbon, classifyTrunkCarbon, true),
      );
    }
  }

  setState(nextState) {
    ACCESS_PARTS.forEach((part) => {
      if (part in nextState) this.state[part] = Boolean(nextState[part]);
    });
  }

  setOpen(open) {
    ACCESS_PARTS.forEach((part) => { this.state[part] = Boolean(open); });
  }

  toggle(part) {
    const map = { 'left-door': 'leftDoor', 'right-door': 'rightDoor', trunk: 'trunk' };
    const id = map[part] ?? part;
    if (!ACCESS_PARTS.includes(id)) return null;
    this.state[id] = !this.state[id];
    return { open: this.state[id], part: id, state: { ...this.state } };
  }

  get open() {
    return ACCESS_PARTS.some((part) => this.state[part]);
  }

  update(delta) {
    ACCESS_PARTS.forEach((part) => {
      this.progress[part] = THREE.MathUtils.damp(
        this.progress[part],
        this.state[part] ? 1 : 0,
        part === 'trunk' ? 4.6 : 5.4,
        delta,
      );
    });

    const left = THREE.MathUtils.smoothstep(this.progress.leftDoor, 0, 1);
    const right = THREE.MathUtils.smoothstep(this.progress.rightDoor, 0, 1);
    const trunk = THREE.MathUtils.smoothstep(this.progress.trunk, 0, 1);
    this.parts.leftDoor.pivot.rotation.y = left * 1.04;
    this.parts.rightDoor.pivot.rotation.y = -right * 1.04;
    this.parts.trunk.pivot.rotation.x = trunk * 0.78;
  }
}
