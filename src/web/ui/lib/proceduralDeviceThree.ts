import * as THREE from 'three';
import {
  DEFAULT_PROCEDURAL_CAMERA_SETTINGS,
  DEFAULT_PROCEDURAL_KEY_LIGHT_SETTINGS,
  DEFAULT_PROCEDURAL_KEY_LIGHT_POSITION,
  PROCEDURAL_CAMERA_POSITION,
  PROCEDURAL_CAMERA_UP,
  PROCEDURAL_DEVICE_BASE_ROTATION_X,
  proceduralKeyLightPositionFromSettings,
  resolveProceduralCameraSettings,
  resolveProceduralDeviceLocation,
  resolveProceduralKeyLightSettings,
  resolveProceduralLightPosition,
  resolveProceduralDeviceRotation,
  resolveProceduralDeviceShape,
  type ProceduralCameraMode,
  type ProceduralCameraSettings,
  type ProceduralDeviceLocation,
  type ProceduralKeyLightSettings,
  type ProceduralLightPosition,
  type ProceduralDeviceRotation,
  type ProceduralDeviceShape,
} from '../../screenshotTemplates/proceduralDeviceConfig';
import type { ScreenshotCanvasImageLoader } from '../../screenshotTemplates/storeScreenshotCanvas';

export type ProceduralDeviceProfile = {
  bodyColor: string;
  bodyMetalness: number;
  bodyRoughness: number;
  bodyClearcoat: number;
  bodyClearcoatRoughness: number;
  bezelColor: string;
  bezelOpacity: number;
  screenFill: string;
  notchColor: string;
};

export const DEFAULT_PROCEDURAL_DEVICE_PROFILE: ProceduralDeviceProfile = {
  bodyColor: '#3c4148',
  bodyMetalness: 0.22,
  bodyRoughness: 0.34,
  bodyClearcoat: 0.4,
  bodyClearcoatRoughness: 0.18,
  bezelColor: '#0d1117',
  bezelOpacity: 0.92,
  screenFill: '#f5f5f2',
  notchColor: '#06080b',
};

const PROCEDURAL_DEVICE_SCREEN_INSET_MM = 2;
const PROCEDURAL_DEVICE_ISLAND_Z_OFFSET_MM = 0.001;
const PROCEDURAL_DEVICE_CURVE_SEGMENT_MULTIPLIER = 2;

export type ProceduralDeviceScreenMetrics = {
  insetX: number;
  insetY: number;
  screenWidth: number;
  screenLength: number;
  screenRadius: number;
};

export async function createProceduralScreenshotTexture(
  screenshotUrl: string | null | undefined,
  imageLoader: ScreenshotCanvasImageLoader,
  targetScreen?: Pick<ProceduralDeviceScreenMetrics, 'screenWidth' | 'screenLength'>
): Promise<THREE.Texture | null> {
  let resolvedTextureSource: CanvasImageSource | null = null;

  if (screenshotUrl != null && screenshotUrl !== '') {
    const image = await imageLoader(screenshotUrl);
    resolvedTextureSource =
      targetScreen != null
        ? renderImageCoverToCanvas(image, targetScreen.screenWidth, targetScreen.screenLength)
        : image;
  } else if (targetScreen != null) {
    resolvedTextureSource = renderPlaceholderScreenToCanvas(
      targetScreen.screenWidth,
      targetScreen.screenLength
    );
  }

  if (!resolvedTextureSource) return null;
  const texture = new THREE.Texture(resolvedTextureSource);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 16;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createProceduralDeviceGroup(input?: {
  shape?: Partial<ProceduralDeviceShape> | null;
  rotation?: Partial<ProceduralDeviceRotation> | null;
  location?: Partial<ProceduralDeviceLocation> | null;
  profile?: Partial<ProceduralDeviceProfile> | null;
  screenshotTexture?: THREE.Texture | null;
  includeScreen?: boolean;
}): THREE.Group {
  const group = new THREE.Group();
  rebuildProceduralDeviceGroup(group, input);
  return group;
}

export function rebuildProceduralDeviceGroup(
  group: THREE.Group,
  input?: {
    shape?: Partial<ProceduralDeviceShape> | null;
    rotation?: Partial<ProceduralDeviceRotation> | null;
    location?: Partial<ProceduralDeviceLocation> | null;
    profile?: Partial<ProceduralDeviceProfile> | null;
    screenshotTexture?: THREE.Texture | null;
    includeScreen?: boolean;
  }
): void {
  clearObject3D(group);

  const shape = resolveProceduralDeviceShape(input?.shape);
  const rotation = resolveProceduralDeviceRotation(input?.rotation);
  const location = resolveProceduralDeviceLocation(input?.location);
  const profile = {
    ...DEFAULT_PROCEDURAL_DEVICE_PROFILE,
    ...(input?.profile ?? {}),
  };
  const includeScreen = input?.includeScreen ?? false;

  const bodyGeometry = createRoundedRectExtrudedGeometry(shape);
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(profile.bodyColor),
    metalness: profile.bodyMetalness,
    roughness: profile.bodyRoughness,
    clearcoat: profile.bodyClearcoat,
    clearcoatRoughness: profile.bodyClearcoatRoughness,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  group.add(body);

  if (includeScreen) {
    const { insetY, screenWidth, screenLength, screenRadius } =
      getProceduralDeviceScreenMetrics(shape);

    const bezel = new THREE.Mesh(
      createRoundedRectPlaneGeometry(screenWidth, screenLength, screenRadius),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(profile.bezelColor),
        transparent: true,
        opacity: profile.bezelOpacity,
      })
    );
    bezel.position.z = shape.thicknessMm / 2 + 0.02;
    group.add(bezel);

    const screenMaterial = input?.screenshotTexture
      ? new THREE.MeshBasicMaterial({
          map: input.screenshotTexture,
          toneMapped: false,
        })
      : new THREE.MeshBasicMaterial({
          color: new THREE.Color(profile.screenFill),
          toneMapped: false,
        });
    const screen = new THREE.Mesh(
      createRoundedRectPlaneGeometry(screenWidth, screenLength, screenRadius),
      screenMaterial
    );
    const screenFrontZ = shape.thicknessMm / 2 + 0.06;
    screen.position.z = screenFrontZ;
    group.add(screen);

    const islandWidth = Math.max(1, Math.min(shape.islandWidthMm, screenWidth));
    const islandLength = Math.max(1, Math.min(shape.islandLengthMm, screenLength));
    const islandRadius = Math.max(
      0,
      Math.min(shape.islandRadiusMm, islandWidth / 2, islandLength / 2)
    );
    const island = new THREE.Mesh(
      createRoundedRectPlaneGeometry(islandWidth, islandLength, islandRadius),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(profile.notchColor),
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
      })
    );
    island.position.set(
      0,
      shape.lengthMm / 2 - insetY - islandLength * 0.8,
      screenFrontZ + PROCEDURAL_DEVICE_ISLAND_Z_OFFSET_MM
    );
    group.add(island);
  }

  applyProceduralDeviceTransform(group, rotation, location);
}

export function applyProceduralDeviceTransform(
  group: THREE.Group,
  rotation?: Partial<ProceduralDeviceRotation> | null,
  location?: Partial<ProceduralDeviceLocation> | null
): void {
  const resolvedRotation = resolveProceduralDeviceRotation(rotation);
  const resolvedLocation = resolveProceduralDeviceLocation(location);
  group.position.set(resolvedLocation.x, resolvedLocation.y, resolvedLocation.z);
  group.rotation.set(
    degToRad(resolvedRotation.rotateX + PROCEDURAL_DEVICE_BASE_ROTATION_X),
    degToRad(resolvedRotation.rotateY),
    degToRad(resolvedRotation.rotateZ)
  );
}

export function configureProceduralPerspectiveCamera(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  fov = DEFAULT_PROCEDURAL_CAMERA_SETTINGS.perspectiveFov
): void {
  camera.fov = fov;
  camera.aspect = width / height;
  camera.near = 50;
  camera.far = 500;
  camera.position.set(
    PROCEDURAL_CAMERA_POSITION.x,
    PROCEDURAL_CAMERA_POSITION.y,
    PROCEDURAL_CAMERA_POSITION.z
  );
  camera.up.set(PROCEDURAL_CAMERA_UP.x, PROCEDURAL_CAMERA_UP.y, PROCEDURAL_CAMERA_UP.z);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

export function configureProceduralOrthographicCamera(
  camera: THREE.OrthographicCamera,
  width: number,
  height: number,
  frustumHeight = DEFAULT_PROCEDURAL_CAMERA_SETTINGS.orthographicFrustumHeight
): void {
  const aspect = width / height;
  camera.left = (-frustumHeight * aspect) / 2;
  camera.right = (frustumHeight * aspect) / 2;
  camera.top = frustumHeight / 2;
  camera.bottom = -frustumHeight / 2;
  camera.near = 0.1;
  camera.far = 5000;
  camera.position.set(
    PROCEDURAL_CAMERA_POSITION.x,
    PROCEDURAL_CAMERA_POSITION.y,
    PROCEDURAL_CAMERA_POSITION.z
  );
  camera.up.set(PROCEDURAL_CAMERA_UP.x, PROCEDURAL_CAMERA_UP.y, PROCEDURAL_CAMERA_UP.z);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

export function getProceduralActiveCamera(
  cameraMode: ProceduralCameraMode,
  perspectiveCamera: THREE.PerspectiveCamera,
  orthographicCamera: THREE.OrthographicCamera
): THREE.PerspectiveCamera | THREE.OrthographicCamera {
  return cameraMode === 'orthographic' ? orthographicCamera : perspectiveCamera;
}

export function createDefaultProceduralLights(
  scene: THREE.Scene,
  input?: {
    keyLightPosition?: Partial<ProceduralLightPosition> | null;
    keyLightSettings?: Partial<ProceduralKeyLightSettings> | null;
  }
): {
  ambientLight: THREE.AmbientLight;
  keyLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
} {
  const keyLightSettings = resolveProceduralKeyLightSettings(
    input?.keyLightSettings,
    input?.keyLightPosition
  );
  const keyLightPosition = proceduralKeyLightPositionFromSettings(keyLightSettings);
  const ambientLight = new THREE.AmbientLight('#f4f7ff', 1.8);
  const keyLight = new THREE.DirectionalLight(
    keyLightSettings.color,
    keyLightSettings.intensity
  );
  keyLight.position.set(keyLightPosition.x, keyLightPosition.y, keyLightPosition.z);
  const rimLight = new THREE.DirectionalLight('#7dd3fc', 1.1);
  rimLight.position.set(-220, 160, -280);
  scene.add(ambientLight, keyLight, rimLight);
  return {
    ambientLight,
    keyLight,
    rimLight,
  };
}

export function applyProceduralKeyLight(
  keyLight: THREE.DirectionalLight,
  input?: {
    keyLightPosition?: Partial<ProceduralLightPosition> | null;
    keyLightSettings?: Partial<ProceduralKeyLightSettings> | null;
  }
): void {
  const keyLightSettings = resolveProceduralKeyLightSettings(
    input?.keyLightSettings,
    input?.keyLightPosition
  );
  const keyLightPosition = proceduralKeyLightPositionFromSettings(keyLightSettings);
  keyLight.position.set(keyLightPosition.x, keyLightPosition.y, keyLightPosition.z);
  keyLight.intensity = keyLightSettings.intensity;
  keyLight.color.set(keyLightSettings.color);
}

export async function renderProceduralDeviceSceneToCanvas(input: {
  width: number;
  height: number;
  imageLoader: ScreenshotCanvasImageLoader;
  screenshotUrl?: string | null;
  shape?: Partial<ProceduralDeviceShape> | null;
  rotation?: Partial<ProceduralDeviceRotation> | null;
  location?: Partial<ProceduralDeviceLocation> | null;
  keyLightPosition?: Partial<ProceduralLightPosition> | null;
  keyLightSettings?: Partial<ProceduralKeyLightSettings> | null;
  cameraMode?: ProceduralCameraMode | null;
  cameraSettings?: Partial<ProceduralCameraSettings> | null;
  profile?: Partial<ProceduralDeviceProfile> | null;
  targetCanvas?: HTMLCanvasElement;
}): Promise<HTMLCanvasElement> {
  const canvas = input.targetCanvas ?? document.createElement('canvas');
  canvas.width = input.width;
  canvas.height = input.height;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(input.width, input.height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  createDefaultProceduralLights(scene, {
    keyLightPosition: input.keyLightPosition ?? DEFAULT_PROCEDURAL_KEY_LIGHT_POSITION,
    keyLightSettings: input.keyLightSettings ?? DEFAULT_PROCEDURAL_KEY_LIGHT_SETTINGS,
  });

  const perspectiveCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 5000);
  const orthographicCamera = new THREE.OrthographicCamera(-240, 240, 240, -240, 0.1, 5000);
  const cameraSettings = resolveProceduralCameraSettings(input.cameraSettings);
  configureProceduralPerspectiveCamera(
    perspectiveCamera,
    input.width,
    input.height,
    cameraSettings.perspectiveFov
  );
  configureProceduralOrthographicCamera(
    orthographicCamera,
    input.width,
    input.height,
    cameraSettings.orthographicFrustumHeight
  );

  const resolvedShape = resolveProceduralDeviceShape(input.shape);
  const screenshotTexture = await createProceduralScreenshotTexture(
    input.screenshotUrl,
    input.imageLoader,
    getProceduralDeviceScreenMetrics(resolvedShape)
  );
  const deviceGroup = createProceduralDeviceGroup({
    shape: resolvedShape,
    rotation: resolveProceduralDeviceRotation(input.rotation),
    location: resolveProceduralDeviceLocation(input.location),
    profile: input.profile,
    screenshotTexture,
    includeScreen: true,
  });
  scene.add(deviceGroup);

  renderer.render(
    scene,
    getProceduralActiveCamera(
      cameraModeOrDefault(input.cameraMode),
      perspectiveCamera,
      orthographicCamera
    )
  );

  screenshotTexture?.dispose();
  disposeSceneGraph(scene, renderer);
  return canvas;
}

export function getProceduralDeviceScreenMetrics(
  shapeInput?: Partial<ProceduralDeviceShape> | null
): ProceduralDeviceScreenMetrics {
  const shape = resolveProceduralDeviceShape(shapeInput);
  const insetX = PROCEDURAL_DEVICE_SCREEN_INSET_MM;
  const insetY = PROCEDURAL_DEVICE_SCREEN_INSET_MM;
  const screenWidth = Math.max(10, shape.widthMm - insetX * 2);
  const screenLength = Math.max(20, shape.lengthMm - insetY * 2);
  const screenRadius = Math.max(
    0,
    Math.min(
      shape.edgeSmoothnessMm - PROCEDURAL_DEVICE_SCREEN_INSET_MM,
      screenWidth / 2,
      screenLength / 2
    )
  );

  return {
    insetX,
    insetY,
    screenWidth,
    screenLength,
    screenRadius,
  };
}

function createRoundedRectPlaneGeometry(
  widthMm: number,
  lengthMm: number,
  edgeSmoothnessMm: number
): THREE.BufferGeometry {
  const shape = createRoundedRectShape(widthMm, lengthMm, edgeSmoothnessMm);
  const geometry = new THREE.ShapeGeometry(shape, getCurveSegments(edgeSmoothnessMm));
  normalizeGeometryUvToBoundingBox(geometry);
  geometry.computeVertexNormals();
  return geometry;
}

function createRoundedRectExtrudedGeometry(shape: ProceduralDeviceShape): THREE.BufferGeometry {
  const roundedRectShape = createRoundedRectShape(
    shape.widthMm,
    shape.lengthMm,
    shape.edgeSmoothnessMm
  );
  const geometry = new THREE.ExtrudeGeometry(roundedRectShape, {
    depth: shape.thicknessMm,
    bevelEnabled: false,
    curveSegments: getCurveSegments(shape.edgeSmoothnessMm),
    steps: 1,
  });
  geometry.translate(0, 0, -shape.thicknessMm / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createRoundedRectShape(
  widthMm: number,
  lengthMm: number,
  edgeSmoothnessMm: number
): THREE.Shape {
  const halfWidth = widthMm / 2;
  const halfLength = lengthMm / 2;
  const radius = Math.min(
    Math.max(0, edgeSmoothnessMm),
    halfWidth,
    halfLength
  );
  const shape = new THREE.Shape();

  if (radius <= 0) {
    shape.moveTo(-halfWidth, -halfLength);
    shape.lineTo(halfWidth, -halfLength);
    shape.lineTo(halfWidth, halfLength);
    shape.lineTo(-halfWidth, halfLength);
    shape.closePath();
    return shape;
  }

  shape.moveTo(-halfWidth + radius, -halfLength);
  shape.lineTo(halfWidth - radius, -halfLength);
  shape.absarc(halfWidth - radius, -halfLength + radius, radius, -Math.PI / 2, 0);
  shape.lineTo(halfWidth, halfLength - radius);
  shape.absarc(halfWidth - radius, halfLength - radius, radius, 0, Math.PI / 2);
  shape.lineTo(-halfWidth + radius, halfLength);
  shape.absarc(-halfWidth + radius, halfLength - radius, radius, Math.PI / 2, Math.PI);
  shape.lineTo(-halfWidth, -halfLength + radius);
  shape.absarc(
    -halfWidth + radius,
    -halfLength + radius,
    radius,
    Math.PI,
    Math.PI * 1.5
  );
  shape.closePath();
  return shape;
}

function getCurveSegments(edgeSmoothnessMm: number): number {
  const baseSegments = Math.min(18, Math.max(6, Math.round(edgeSmoothnessMm / 6) + 4));
  return Math.min(36, Math.max(12, baseSegments * PROCEDURAL_DEVICE_CURVE_SEGMENT_MULTIPLIER));
}

function normalizeGeometryUvToBoundingBox(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox();
  const boundingBox = geometry.boundingBox;
  const position = geometry.getAttribute('position');
  if (!boundingBox || !position) return;

  const width = Math.max(0.0001, boundingBox.max.x - boundingBox.min.x);
  const height = Math.max(0.0001, boundingBox.max.y - boundingBox.min.y);
  const uv = new Float32Array(position.count * 2);

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    uv[index * 2] = (x - boundingBox.min.x) / width;
    uv[index * 2 + 1] = (y - boundingBox.min.y) / height;
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function renderImageCoverToCanvas(
  image: CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number },
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const widthPx = Math.max(256, Math.round(targetWidth * 18));
  const heightPx = Math.max(256, Math.round(targetHeight * 18));
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const sourceWidth = image.naturalWidth ?? image.width ?? widthPx;
  const sourceHeight = image.naturalHeight ?? image.height ?? heightPx;
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = widthPx / heightPx;

  let drawWidth = widthPx;
  let drawHeight = heightPx;
  let offsetX = 0;
  let offsetY = 0;

  if (sourceAspect > targetAspect) {
    drawHeight = heightPx;
    drawWidth = drawHeight * sourceAspect;
    offsetX = (widthPx - drawWidth) / 2;
  } else {
    drawWidth = widthPx;
    drawHeight = drawWidth / sourceAspect;
    offsetY = (heightPx - drawHeight) / 2;
  }

  ctx.clearRect(0, 0, widthPx, heightPx);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return canvas;
}

function renderPlaceholderScreenToCanvas(
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const widthPx = Math.max(256, Math.round(targetWidth * 18));
  const heightPx = Math.max(256, Math.round(targetHeight * 18));
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#f5f5f2';
  ctx.fillRect(0, 0, widthPx, heightPx);

  ctx.fillStyle = '#6b6b6d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(widthPx * 0.086)}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('Replace me', widthPx / 2, heightPx * 0.47);

  ctx.fillStyle = '#8a8a8d';
  ctx.font = `500 ${Math.round(widthPx * 0.038)}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('(follow the “How to use”', widthPx / 2, heightPx * 0.54);
  ctx.fillText('instructions)', widthPx / 2, heightPx * 0.59);

  const gloss = ctx.createLinearGradient(0, 0, 0, heightPx * 0.22);
  gloss.addColorStop(0, 'rgba(255,255,255,0.16)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, widthPx, heightPx * 0.22);
  return canvas;
}

function clearObject3D(object: THREE.Object3D): void {
  while (object.children.length > 0) {
    const child = object.children[0];
    object.remove(child);
    child.traverse((node: THREE.Object3D) => {
      const mesh = node as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(disposeMaterial);
      } else if (mesh.material) {
        disposeMaterial(mesh.material);
      }
    });
  }
}

function disposeSceneGraph(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  scene.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(disposeMaterial);
    } else if (mesh.material) {
      disposeMaterial(mesh.material);
    }
  });
  renderer.dispose();
}

function disposeMaterial(material: THREE.Material): void {
  const textureMaterial = material as THREE.MeshBasicMaterial & { map?: THREE.Texture | null };
  textureMaterial.map?.dispose();
  material.dispose();
}

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function cameraModeOrDefault(value?: ProceduralCameraMode | null): ProceduralCameraMode {
  return value === 'orthographic' ? 'orthographic' : 'perspective';
}
