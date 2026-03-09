import * as THREE from 'three';
import './sstest.css';
import {
  DEFAULT_PROCEDURAL_CAMERA_MODE,
  DEFAULT_PROCEDURAL_DEVICE_LOCATION,
  DEFAULT_PROCEDURAL_DEVICE_ROTATION,
  DEFAULT_PROCEDURAL_DEVICE_SHAPE,
  resolveProceduralDeviceLocation,
  resolveProceduralDeviceRotation,
  resolveProceduralDeviceShape,
  type ProceduralCameraMode,
} from '../screenshotTemplates/proceduralDeviceConfig';
import {
  applyProceduralDeviceTransform,
  configureProceduralOrthographicCamera,
  configureProceduralPerspectiveCamera,
  createDefaultProceduralLights,
  createProceduralDeviceGroup,
  getProceduralActiveCamera,
  rebuildProceduralDeviceGroup,
} from './lib/proceduralDeviceThree';

type SceneState = {
  widthMm: number;
  lengthMm: number;
  edgeSmoothnessMm: number;
  thicknessMm: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
};

type DisplayMode = 'solid' | 'wireframe';
type CameraMode = ProceduralCameraMode;
type AxesMode = 'on' | 'off';

const DEFAULT_STATE: SceneState = {
  widthMm: DEFAULT_PROCEDURAL_DEVICE_SHAPE.widthMm,
  lengthMm: DEFAULT_PROCEDURAL_DEVICE_SHAPE.lengthMm,
  edgeSmoothnessMm: DEFAULT_PROCEDURAL_DEVICE_SHAPE.edgeSmoothnessMm,
  thicknessMm: DEFAULT_PROCEDURAL_DEVICE_SHAPE.thicknessMm,
  positionX: DEFAULT_PROCEDURAL_DEVICE_LOCATION.x,
  positionY: DEFAULT_PROCEDURAL_DEVICE_LOCATION.y,
  positionZ: DEFAULT_PROCEDURAL_DEVICE_LOCATION.z,
  rotationX: DEFAULT_PROCEDURAL_DEVICE_ROTATION.rotateX,
  rotationY: DEFAULT_PROCEDURAL_DEVICE_ROTATION.rotateY,
  rotationZ: DEFAULT_PROCEDURAL_DEVICE_ROTATION.rotateZ,
};

const root = document.getElementById('sstest-app');
if (!root) {
  throw new Error('sstest root bulunamadı.');
}

root.innerHTML = `
  <div class="sstest-shell">
    <section class="sstest-stage">
      <canvas class="sstest-canvas"></canvas>
      <div class="sstest-overlay">
        <h1>SS Test Scene</h1>
        <p>Independent Three.js procedural slab scene. Units are millimeters.</p>
      </div>
    </section>
    <aside class="sstest-panel">
      <section class="sstest-card">
        <h2>Shape</h2>
        <div class="sstest-grid">
          <div class="sstest-field">
            <label for="widthMm">Width (mm)</label>
            <input id="widthMm" name="widthMm" type="number" step="0.1" value="71.9" />
          </div>
          <div class="sstest-field">
            <label for="lengthMm">Length (mm)</label>
            <input id="lengthMm" name="lengthMm" type="number" step="0.1" value="150" />
          </div>
          <div class="sstest-field sstest-field--full">
            <label for="edgeSmoothnessMm">Edge Smoothness (mm)</label>
            <input id="edgeSmoothnessMm" name="edgeSmoothnessMm" type="number" step="1" value="9" />
          </div>
          <div class="sstest-field sstest-field--full">
            <label for="thicknessMm">Thickness (mm)</label>
            <input id="thicknessMm" name="thicknessMm" type="number" step="0.01" value="8.75" />
          </div>
        </div>
      </section>

      <section class="sstest-card">
        <h2>Location</h2>
        <div class="sstest-grid">
          <div class="sstest-field">
            <label for="positionX">X</label>
            <input id="positionX" name="positionX" type="number" step="1" value="0" />
          </div>
          <div class="sstest-field">
            <label for="positionY">Y</label>
            <input id="positionY" name="positionY" type="number" step="1" value="0" />
          </div>
          <div class="sstest-field">
            <label for="positionZ">Z</label>
            <input id="positionZ" name="positionZ" type="number" step="1" value="0" />
          </div>
        </div>
      </section>

      <section class="sstest-card">
        <h2>Rotation</h2>
        <div class="sstest-grid">
          <div class="sstest-field">
            <label for="rotationX">X</label>
            <input id="rotationX" name="rotationX" type="number" step="1" value="0" />
          </div>
          <div class="sstest-field">
            <label for="rotationY">Y</label>
            <input id="rotationY" name="rotationY" type="number" step="1" value="0" />
          </div>
          <div class="sstest-field">
            <label for="rotationZ">Z</label>
            <input id="rotationZ" name="rotationZ" type="number" step="1" value="0" />
          </div>
        </div>
      </section>

      <section class="sstest-card">
        <h2>Display</h2>
        <div class="sstest-actions">
          <button class="sstest-button sstest-button--ghost" type="button" data-display-mode="solid">Solid</button>
          <button class="sstest-button sstest-button--ghost" type="button" data-display-mode="wireframe">Wireframe</button>
        </div>
      </section>

      <section class="sstest-card">
        <h2>Camera</h2>
        <div class="sstest-actions">
          <button class="sstest-button sstest-button--ghost" type="button" data-camera-mode="perspective">Perspective</button>
          <button class="sstest-button sstest-button--ghost" type="button" data-camera-mode="orthographic">Orthographic</button>
        </div>
      </section>

      <section class="sstest-card">
        <h2>Axes</h2>
        <div class="sstest-actions">
          <button class="sstest-button sstest-button--ghost" type="button" data-axes-mode="on">On</button>
          <button class="sstest-button sstest-button--ghost" type="button" data-axes-mode="off">Off</button>
        </div>
      </section>

      <section class="sstest-card">
        <div class="sstest-actions">
          <button class="sstest-button sstest-button--primary" type="button" data-action="reset">Reset</button>
        </div>
      </section>

      <section class="sstest-card">
        <h2>Readout</h2>
        <pre class="sstest-readout"></pre>
      </section>
    </aside>
  </div>
`;

const canvas = root.querySelector<HTMLCanvasElement>('.sstest-canvas');
const readout = root.querySelector<HTMLPreElement>('.sstest-readout');
const resetButton = root.querySelector<HTMLButtonElement>('[data-action="reset"]');
const stage = root.querySelector<HTMLElement>('.sstest-stage');
const displayModeButtons = Array.from(
  root.querySelectorAll<HTMLButtonElement>('[data-display-mode]')
);
const cameraModeButtons = Array.from(
  root.querySelectorAll<HTMLButtonElement>('[data-camera-mode]')
);
const axesModeButtons = Array.from(
  root.querySelectorAll<HTMLButtonElement>('[data-axes-mode]')
);
const inputMap = new Map(
  Array.from(root.querySelectorAll<HTMLInputElement>('input[name]')).map((input) => [input.name, input])
);

if (!canvas || !readout || !resetButton || !stage) {
  throw new Error('sstest DOM kurulamadı.');
}

const canvasEl = canvas;
const readoutEl = readout;
const stageEl = stage;

const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0f1115');
scene.fog = new THREE.Fog('#0f1115', 600, 1800);

const perspectiveCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 5000);
const orthographicCamera = new THREE.OrthographicCamera(-240, 240, 240, -240, 0.1, 5000);

createDefaultProceduralLights(scene);

const groundShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(2200, 2200),
  new THREE.ShadowMaterial({ color: '#000000', opacity: 0.22 })
);
groundShadow.rotation.x = -Math.PI / 2;
groundShadow.position.y = -140;
groundShadow.receiveShadow = true;
scene.add(groundShadow);

const grid = new THREE.GridHelper(1200, 24, '#2b3645', '#1c2430');
grid.position.y = -139;
scene.add(grid);

const axesGroup = new THREE.Group();
const axes = new THREE.AxesHelper(180);
axesGroup.add(axes);
axesGroup.add(createAxisLabelSprite('X', '#ff6b6b', new THREE.Vector3(208, 0, 0)));
axesGroup.add(createAxisLabelSprite('Y', '#8ce99a', new THREE.Vector3(0, 208, 0)));
axesGroup.add(createAxisLabelSprite('Z', '#74c0fc', new THREE.Vector3(0, 0, 208)));
scene.add(axesGroup);

const deviceGroup = createProceduralDeviceGroup({
  shape: DEFAULT_PROCEDURAL_DEVICE_SHAPE,
  rotation: DEFAULT_PROCEDURAL_DEVICE_ROTATION,
  location: DEFAULT_PROCEDURAL_DEVICE_LOCATION,
  profile: {
    bodyColor: '#3c4148',
  },
  includeScreen: false,
});
scene.add(deviceGroup);

const state: SceneState = { ...DEFAULT_STATE };
let displayMode: DisplayMode = 'solid';
let cameraMode: CameraMode = DEFAULT_PROCEDURAL_CAMERA_MODE;
let axesMode: AxesMode = 'off';
let lastShapeKey = '';
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let dragState:
  | {
      pointerId: number;
      startClientX: number;
      startClientY: number;
      startRotationX: number;
      startRotationY: number;
      startRotationZ: number;
    }
  | undefined;

const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('input[name]'));

function getActiveCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
  return getProceduralActiveCamera(cameraMode, perspectiveCamera, orthographicCamera);
}

function setCanvasSize(): void {
  const width = Math.max(320, Math.floor(stageEl.clientWidth));
  const height = Math.max(320, Math.floor(stageEl.clientHeight));
  renderer.setSize(width, height, false);
  configureProceduralPerspectiveCamera(perspectiveCamera, width, height);
  configureProceduralOrthographicCamera(orthographicCamera, width, height, 460);
  render();
}

function getPointerNdc(event: PointerEvent): THREE.Vector2 {
  const rect = canvasEl.getBoundingClientRect();
  pointerNdc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  return pointerNdc;
}

function applyState(): void {
  const resolvedShape = resolveProceduralDeviceShape({
    widthMm: state.widthMm,
    lengthMm: state.lengthMm,
    thicknessMm: state.thicknessMm,
    edgeSmoothnessMm: state.edgeSmoothnessMm,
  });
  const shapeKey = JSON.stringify(resolvedShape);
  if (shapeKey !== lastShapeKey) {
    rebuildProceduralDeviceGroup(deviceGroup, {
      shape: resolvedShape,
      profile: {
        bodyColor: '#3c4148',
      },
      includeScreen: false,
    });
    lastShapeKey = shapeKey;
  }

  applyProceduralDeviceTransform(
    deviceGroup,
    resolveProceduralDeviceRotation({
      rotateX: state.rotationX,
      rotateY: state.rotationY,
      rotateZ: state.rotationZ,
    }),
    resolveProceduralDeviceLocation({
      x: state.positionX,
      y: state.positionY,
      z: state.positionZ,
    })
  );

  setGroupWireframe(deviceGroup, displayMode === 'wireframe');
  axesGroup.visible = axesMode === 'on';

  syncInputsFromState();
  syncToggleButtons();
  readoutEl.textContent = JSON.stringify(
    {
      ...state,
      displayMode,
      cameraMode,
      axesMode,
    },
    null,
    2
  );
  render();
}

function render(): void {
  renderer.render(scene, getActiveCamera());
}

function syncToggleButtons(): void {
  for (const button of displayModeButtons) {
    const isActive = button.dataset.displayMode === displayMode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  }

  for (const button of cameraModeButtons) {
    const isActive = button.dataset.cameraMode === cameraMode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  }

  for (const button of axesModeButtons) {
    const isActive = button.dataset.axesMode === axesMode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  }
}

function parseInputValue(input: HTMLInputElement): number {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : 0;
}

function syncInputsFromState(): void {
  for (const [key, input] of inputMap) {
    const typedKey = key as keyof SceneState;
    input.value = formatStateValue(typedKey, state[typedKey]);
  }
}

function formatStateValue(key: keyof SceneState, value: number): string {
  if (key === 'thicknessMm') {
    return value.toFixed(2).replace(/\.?0+$/, '');
  }

  if (key === 'widthMm' || key === 'lengthMm') {
    return value.toFixed(1).replace(/\.?0+$/, '');
  }

  if (key === 'rotationX' || key === 'rotationY' || key === 'rotationZ') {
    return value.toFixed(2).replace(/\.?0+$/, '');
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

function normalizeAngle(angle: number): number {
  const normalized = ((angle + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function updateCanvasCursor(event?: PointerEvent): void {
  if (dragState) {
    canvasEl.style.cursor = 'grabbing';
    return;
  }

  if (!event) {
    canvasEl.style.cursor = 'default';
    return;
  }

  raycaster.setFromCamera(getPointerNdc(event), getActiveCamera());
  const intersects = raycaster.intersectObject(deviceGroup, true);
  canvasEl.style.cursor = intersects.length > 0 ? 'grab' : 'default';
}

for (const input of inputs) {
  input.addEventListener('input', () => {
    const key = input.name as keyof SceneState;
    const nextValue = parseInputValue(input);
    state[key] =
      key === 'widthMm' || key === 'lengthMm'
        ? Math.max(1, nextValue)
        : key === 'edgeSmoothnessMm' || key === 'thicknessMm'
          ? Math.max(0, nextValue)
          : nextValue;
    if (
      key === 'widthMm' ||
      key === 'lengthMm' ||
      key === 'edgeSmoothnessMm' ||
      key === 'thicknessMm'
    ) {
      input.value = String(state[key]);
    }
    applyState();
  });
}

canvasEl.addEventListener('pointerdown', (event) => {
  raycaster.setFromCamera(getPointerNdc(event), getActiveCamera());
  const intersects = raycaster.intersectObject(deviceGroup, true);
  if (intersects.length === 0) {
    updateCanvasCursor(event);
    return;
  }

  dragState = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startRotationX: state.rotationX,
    startRotationY: state.rotationY,
    startRotationZ: state.rotationZ,
  };
  canvasEl.setPointerCapture(event.pointerId);
  stageEl.classList.add('is-dragging');
  updateCanvasCursor();
});

canvasEl.addEventListener('pointermove', (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) {
    updateCanvasCursor(event);
    return;
  }

  const deltaX = event.clientX - dragState.startClientX;
  const deltaY = event.clientY - dragState.startClientY;
  const rotationSensitivity = 0.35;

  state.rotationX = normalizeAngle(dragState.startRotationX - deltaY * rotationSensitivity);
  state.rotationY = normalizeAngle(dragState.startRotationY);
  state.rotationZ = normalizeAngle(dragState.startRotationZ - deltaX * rotationSensitivity);

  applyState();
});

function stopDragging(pointerId?: number): void {
  if (pointerId !== undefined && dragState && dragState.pointerId !== pointerId) {
    return;
  }

  dragState = undefined;
  stageEl.classList.remove('is-dragging');
  updateCanvasCursor();
}

canvasEl.addEventListener('pointerup', (event) => {
  if (canvasEl.hasPointerCapture(event.pointerId)) {
    canvasEl.releasePointerCapture(event.pointerId);
  }
  stopDragging(event.pointerId);
});

canvasEl.addEventListener('pointercancel', (event) => {
  if (canvasEl.hasPointerCapture(event.pointerId)) {
    canvasEl.releasePointerCapture(event.pointerId);
  }
  stopDragging(event.pointerId);
});

canvasEl.addEventListener('pointerleave', (event) => {
  if (!dragState) {
    updateCanvasCursor(event);
  }
});

for (const button of displayModeButtons) {
  button.addEventListener('click', () => {
    const nextMode = button.dataset.displayMode;
    if (nextMode === 'solid' || nextMode === 'wireframe') {
      displayMode = nextMode;
      applyState();
    }
  });
}

for (const button of cameraModeButtons) {
  button.addEventListener('click', () => {
    const nextMode = button.dataset.cameraMode;
    if (nextMode === 'perspective' || nextMode === 'orthographic') {
      cameraMode = nextMode;
      render();
      syncToggleButtons();
      readout.textContent = JSON.stringify(
        {
          ...state,
          displayMode,
          cameraMode,
          axesMode,
        },
        null,
        2
      );
    }
  });
}

for (const button of axesModeButtons) {
  button.addEventListener('click', () => {
    const nextMode = button.dataset.axesMode;
    if (nextMode === 'on' || nextMode === 'off') {
      axesMode = nextMode;
      applyState();
    }
  });
}

resetButton.addEventListener('click', () => {
  Object.assign(state, DEFAULT_STATE);
  displayMode = 'solid';
  cameraMode = DEFAULT_PROCEDURAL_CAMERA_MODE;
  axesMode = 'off';
  for (const input of inputs) {
    const key = input.name as keyof SceneState;
    input.value = String(state[key]);
  }
  applyState();
});

window.addEventListener('resize', setCanvasSize);
setCanvasSize();
applyState();

function setGroupWireframe(object: THREE.Object3D, enabled: boolean): void {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.material) return;
    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        if ('wireframe' in material) {
          material.wireframe = enabled;
        }
      }
      return;
    }
    if ('wireframe' in mesh.material) {
      mesh.material.wireframe = enabled;
    }
  });
}

function createAxisLabelSprite(
  label: 'X' | 'Y' | 'Z',
  color: string,
  position: THREE.Vector3
): THREE.Sprite {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 128;
  labelCanvas.height = 128;

  const context = labelCanvas.getContext('2d');
  if (!context) {
    throw new Error('Axis label canvas context oluşturulamadı.');
  }

  context.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
  context.fillStyle = 'rgba(10, 14, 20, 0.88)';
  context.beginPath();
  context.arc(64, 64, 42, 0, Math.PI * 2);
  context.fill();

  context.lineWidth = 4;
  context.strokeStyle = color;
  context.stroke();

  context.fillStyle = color;
  context.font = '700 56px ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, 64, 68);

  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(32, 32, 1);
  sprite.renderOrder = 100;
  return sprite;
}
