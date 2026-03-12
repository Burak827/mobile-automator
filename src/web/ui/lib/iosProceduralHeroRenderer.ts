import * as THREE from 'three';
import {
  DEFAULT_PROCEDURAL_CAMERA_MODE,
  DEFAULT_PROCEDURAL_CAMERA_SETTINGS,
  DEFAULT_PROCEDURAL_DEVICE_LOCATION,
  getDefaultCameraModeForSlot,
  resolveProceduralCameraMode,
  resolveProceduralCameraSettings,
  resolveProceduralDeviceLocation,
  resolveProceduralDeviceRotation,
  resolveProceduralDeviceShape,
  type IosHeroPhonePose,
  type IosHeroPhoneShape,
  type ProceduralCameraMode,
  type ProceduralCameraSettings,
  type ProceduralDeviceLocation,
  type ProceduralKeyLightSettings,
  type ProceduralLightPosition,
} from '../../screenshotTemplates/proceduralDeviceConfig';
import {
  drawIosPosterBackdrop,
  IOS_HERO_SPLIT_SEAM_GAP_PX,
  IOS_HERO_SLOT_2_SCENE_OFFSET_Y,
  IOS_HERO_SPLIT_SCENE_WIDTH_MULTIPLIER,
  buildTitleLines,
  drawIosSplitHeroBackdrop,
  drawIosSplitHeroSharedDecor,
  type ScreenshotCanvasImageLoader,
} from '../../screenshotTemplates/storeScreenshotCanvas';
import {
  resolveSlot1SbeSettings,
  type Slot1SbeSettings,
} from '../../screenshotTemplates/slot1Sbe';
import {
  resolveScreenshotTitleTypography,
  type ScreenshotTitleTypography,
} from '../../screenshotTemplates/screenshotTitleTypography';
import { resolveScreenshotTitleLineColors } from '../../screenshotTemplates/screenshotTitleColors';
import type {
  ScreenshotTemplatePalette,
} from '../../screenshotTemplates/storeScreenshotTemplateRegistry';
import {
  applyProceduralKeyLight,
  applyProceduralDeviceTransform,
  configureProceduralOrthographicCamera,
  configureProceduralPerspectiveCamera,
  createDefaultProceduralLights,
  createProceduralDeviceGroup,
  createProceduralScreenshotTexture,
  getProceduralDeviceScreenMetrics,
  getProceduralActiveCamera,
  renderProceduralDeviceSceneToCanvas,
  rebuildProceduralDeviceGroup,
} from './proceduralDeviceThree';

type RenderInput = {
  slot: 1 | 2;
  title: string;
  titleTypography?: Partial<ScreenshotTitleTypography> | null;
  titleExtraLineColors?: string[];
  titleLineGap?: number | null;
  palette: ScreenshotTemplatePalette;
  screenshotUrl: string;
  imageLoader: ScreenshotCanvasImageLoader;
  heroPhonePose?: Partial<IosHeroPhonePose> | null;
  heroPhoneShape?: Partial<IosHeroPhoneShape> | null;
  heroPhoneLocation?: Partial<ProceduralDeviceLocation> | null;
  heroKeyLightPosition?: Partial<ProceduralLightPosition> | null;
  heroKeyLightSettings?: Partial<ProceduralKeyLightSettings> | null;
  slot1SbeSettings?: Partial<Slot1SbeSettings> | null;
  heroCameraMode?: ProceduralCameraMode | null;
  heroCameraSettings?: Partial<ProceduralCameraSettings> | null;
  width: number;
  height: number;
  targetCanvas?: HTMLCanvasElement;
  previewRuntimeKey?: object;
};

type HeroRuntime = {
  sceneCanvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  perspectiveCamera: THREE.PerspectiveCamera;
  orthographicCamera: THREE.OrthographicCamera;
  deviceGroup: THREE.Group;
  keyLight: THREE.DirectionalLight;
  screenshotUrl: string | null;
  shapeKey: string | null;
  profileKey: string | null;
};

const HERO_RUNTIME_BY_KEY = new WeakMap<object, HeroRuntime>();
const DEFAULT_PHONE_COLOR = '#000000';

function getDeviceProfile(palette?: ScreenshotTemplatePalette | null) {
  return {
    bodyColor: palette?.phoneColor || DEFAULT_PHONE_COLOR,
  };
}
const HERO_BASE_LOCATION = {
  ...DEFAULT_PROCEDURAL_DEVICE_LOCATION,
  z: -34,
};
const POSTER_DEVICE_FRAME = {
  x: 146,
  y: 930,
  width: 992,
  height: 1988,
} as const;
const POSTER_DEVICE_ROTATION = {
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
} as const;
const POSTER_DEVICE_LOCATION = {
  x: 0,
  y: 0,
  z: 0,
} as const;

export async function renderIosProceduralHeroComposite(input: RenderInput): Promise<HTMLCanvasElement> {
  const finalCanvas = input.targetCanvas ?? document.createElement('canvas');
  finalCanvas.width = input.width;
  finalCanvas.height = input.height;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) {
    throw new Error('Final canvas context alınamadı.');
  }

  const titleLines = buildTitleLines(input.slot, input.title);
  const titleTypography = resolveScreenshotTitleTypography('ios', input.slot, input.titleTypography);
  const titleLineColors = resolveScreenshotTitleLineColors(
    'ios',
    input.slot,
    input.palette,
    titleLines.length,
    input.titleExtraLineColors
  );
  drawIosSplitHeroBackdrop(finalCtx, {
    slot: input.slot,
    titleLines,
    titleTypography,
    titleLineColors,
    titleLineGap: input.titleLineGap,
    palette: input.palette,
    slot1SbeSettings: input.slot === 1 ? resolveSlot1SbeSettings(input.slot1SbeSettings) : null,
    width: input.width,
    height: input.height,
  });

  const sceneWidth =
    input.width * IOS_HERO_SPLIT_SCENE_WIDTH_MULTIPLIER + IOS_HERO_SPLIT_SEAM_GAP_PX;
  const sceneOffsetX = input.slot === 1 ? 0 : input.width + IOS_HERO_SPLIT_SEAM_GAP_PX;
  const sceneOffsetY = input.slot === 2 ? IOS_HERO_SLOT_2_SCENE_OFFSET_Y : 0;

  finalCtx.save();
  finalCtx.beginPath();
  finalCtx.rect(0, 0, input.width, input.height);
  finalCtx.clip();
  finalCtx.translate(-sceneOffsetX, sceneOffsetY);

  drawIosSplitHeroSharedDecor(finalCtx, {
    palette: input.palette,
    sceneWidth,
    height: input.height,
  });

  const cameraModeFallback = getDefaultCameraModeForSlot(input.slot);
  const deviceProfile = getDeviceProfile(input.palette);
  const sceneCanvas = input.previewRuntimeKey
    ? await renderHeroSceneWithRuntime(input.previewRuntimeKey, {
        sceneWidth,
        height: input.height,
        screenshotUrl: input.screenshotUrl,
        imageLoader: input.imageLoader,
        heroPhonePose: input.heroPhonePose,
        heroPhoneShape: input.heroPhoneShape,
        heroPhoneLocation: input.heroPhoneLocation,
        heroKeyLightPosition: input.heroKeyLightPosition,
        heroKeyLightSettings: input.heroKeyLightSettings,
        heroCameraMode: input.heroCameraMode ?? cameraModeFallback,
        heroCameraSettings: input.heroCameraSettings,
        deviceProfile,
      })
    : await renderHeroSceneOneShot({
        sceneWidth,
        height: input.height,
        screenshotUrl: input.screenshotUrl,
        imageLoader: input.imageLoader,
        heroPhonePose: input.heroPhonePose,
        heroPhoneShape: input.heroPhoneShape,
        heroPhoneLocation: input.heroPhoneLocation,
        heroKeyLightPosition: input.heroKeyLightPosition,
        heroKeyLightSettings: input.heroKeyLightSettings,
        heroCameraMode: input.heroCameraMode ?? cameraModeFallback,
        heroCameraSettings: input.heroCameraSettings,
        deviceProfile,
      });
  finalCtx.drawImage(sceneCanvas, 0, 0, sceneWidth, input.height);
  finalCtx.restore();

  return finalCanvas;
}

export async function renderIosProceduralPosterComposite(input: {
  slot: 3 | 4 | 5 | 6;
  title: string;
  titleTypography?: Partial<ScreenshotTitleTypography> | null;
  titleExtraLineColors?: string[];
  titleLineGap?: number | null;
  palette: ScreenshotTemplatePalette;
  screenshotUrl: string;
  imageLoader: ScreenshotCanvasImageLoader;
  heroPhoneShape?: Partial<IosHeroPhoneShape> | null;
  width: number;
  height: number;
  targetCanvas?: HTMLCanvasElement;
}): Promise<HTMLCanvasElement> {
  const finalCanvas = input.targetCanvas ?? document.createElement('canvas');
  finalCanvas.width = input.width;
  finalCanvas.height = input.height;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) {
    throw new Error('Final canvas context alınamadı.');
  }

  const titleLines = buildTitleLines(input.slot, input.title);
  drawIosPosterBackdrop(finalCtx, {
    slot: input.slot,
    titleLines,
    titleTypography: resolveScreenshotTitleTypography('ios', input.slot, input.titleTypography),
    titleLineColors: resolveScreenshotTitleLineColors(
      'ios',
      input.slot,
      input.palette,
      titleLines.length,
      input.titleExtraLineColors
    ),
    titleLineGap: input.titleLineGap,
    palette: input.palette,
    width: input.width,
    height: input.height,
  });

  const deviceCanvas = await renderProceduralDeviceSceneToCanvas({
    width: POSTER_DEVICE_FRAME.width,
    height: POSTER_DEVICE_FRAME.height,
    imageLoader: input.imageLoader,
    screenshotUrl: input.screenshotUrl,
    shape: input.heroPhoneShape,
    rotation: POSTER_DEVICE_ROTATION,
    location: POSTER_DEVICE_LOCATION,
    cameraMode: 'orthographic',
    profile: getDeviceProfile(input.palette),
  });

  finalCtx.drawImage(
    deviceCanvas,
    POSTER_DEVICE_FRAME.x,
    POSTER_DEVICE_FRAME.y,
    POSTER_DEVICE_FRAME.width,
    POSTER_DEVICE_FRAME.height
  );

  return finalCanvas;
}

function getResolvedDeviceLocation(
  heroPhoneLocation?: Partial<ProceduralDeviceLocation> | null
): ProceduralDeviceLocation {
  const location = resolveProceduralDeviceLocation(heroPhoneLocation);
  return {
    x: HERO_BASE_LOCATION.x + location.x,
    y: HERO_BASE_LOCATION.y + location.y,
    z: HERO_BASE_LOCATION.z + location.z,
  };
}

async function renderHeroSceneOneShot(input: {
  sceneWidth: number;
  height: number;
  screenshotUrl: string;
  imageLoader: ScreenshotCanvasImageLoader;
  heroPhonePose?: Partial<IosHeroPhonePose> | null;
  heroPhoneShape?: Partial<IosHeroPhoneShape> | null;
  heroPhoneLocation?: Partial<ProceduralDeviceLocation> | null;
  heroKeyLightPosition?: Partial<ProceduralLightPosition> | null;
  heroKeyLightSettings?: Partial<ProceduralKeyLightSettings> | null;
  heroCameraMode?: ProceduralCameraMode | null;
  heroCameraSettings?: Partial<ProceduralCameraSettings> | null;
  deviceProfile?: Record<string, string>;
}): Promise<HTMLCanvasElement> {
  const sceneCanvas = document.createElement('canvas');
  sceneCanvas.width = input.sceneWidth;
  sceneCanvas.height = input.height;
  const renderer = new THREE.WebGLRenderer({
    canvas: sceneCanvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(input.sceneWidth, input.height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  createDefaultProceduralLights(scene, {
    keyLightPosition: input.heroKeyLightPosition,
    keyLightSettings: input.heroKeyLightSettings,
  });

  const perspectiveCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 5000);
  const orthographicCamera = new THREE.OrthographicCamera(-240, 240, 240, -240, 0.1, 5000);
  const cameraSettings = resolveProceduralCameraSettings(input.heroCameraSettings);
  configureProceduralPerspectiveCamera(
    perspectiveCamera,
    input.sceneWidth,
    input.height,
    cameraSettings.perspectiveFov
  );
  configureProceduralOrthographicCamera(
    orthographicCamera,
    input.sceneWidth,
    input.height,
    cameraSettings.orthographicFrustumHeight
  );

  const resolvedShape = resolveProceduralDeviceShape(input.heroPhoneShape);
  const screenMetrics = getProceduralDeviceScreenMetrics(resolvedShape);
  const screenshotTexture = await createProceduralScreenshotTexture(
    input.screenshotUrl,
    input.imageLoader,
    screenMetrics
  );
  const deviceGroup = createProceduralDeviceGroup({
    shape: resolvedShape,
    rotation: resolveProceduralDeviceRotation(input.heroPhonePose),
    location: getResolvedDeviceLocation(input.heroPhoneLocation),
    profile: input.deviceProfile,
    screenshotTexture,
    includeScreen: true,
  });
  scene.add(deviceGroup);

  renderer.render(
    scene,
    getProceduralActiveCamera(
      resolveProceduralCameraMode(input.heroCameraMode ?? DEFAULT_PROCEDURAL_CAMERA_MODE),
      perspectiveCamera,
      orthographicCamera
    )
  );

  screenshotTexture?.dispose();
  disposeHeroScene(scene, renderer);
  return sceneCanvas;
}

async function renderHeroSceneWithRuntime(
  runtimeKey: object,
  input: {
    sceneWidth: number;
    height: number;
    screenshotUrl: string;
    imageLoader: ScreenshotCanvasImageLoader;
    heroPhonePose?: Partial<IosHeroPhonePose> | null;
    heroPhoneShape?: Partial<IosHeroPhoneShape> | null;
    heroPhoneLocation?: Partial<ProceduralDeviceLocation> | null;
  heroKeyLightPosition?: Partial<ProceduralLightPosition> | null;
  heroKeyLightSettings?: Partial<ProceduralKeyLightSettings> | null;
  heroCameraMode?: ProceduralCameraMode | null;
  heroCameraSettings?: Partial<ProceduralCameraSettings> | null;
  deviceProfile?: Record<string, string>;
  }
): Promise<HTMLCanvasElement> {
  let runtime = HERO_RUNTIME_BY_KEY.get(runtimeKey);
  if (!runtime || runtime.sceneCanvas.width !== input.sceneWidth || runtime.sceneCanvas.height !== input.height) {
    if (runtime) {
      disposeHeroRuntime(runtime);
    }
    runtime = createHeroRuntime(input.sceneWidth, input.height);
    HERO_RUNTIME_BY_KEY.set(runtimeKey, runtime);
  }

  const cameraSettings = resolveProceduralCameraSettings(input.heroCameraSettings);
  configureProceduralPerspectiveCamera(
    runtime.perspectiveCamera,
    input.sceneWidth,
    input.height,
    cameraSettings.perspectiveFov
  );
  configureProceduralOrthographicCamera(
    runtime.orthographicCamera,
    input.sceneWidth,
    input.height,
    cameraSettings.orthographicFrustumHeight
  );

  applyProceduralKeyLight(runtime.keyLight, {
    keyLightPosition: input.heroKeyLightPosition,
    keyLightSettings: input.heroKeyLightSettings,
  });

  const nextShape = resolveProceduralDeviceShape(input.heroPhoneShape);
  const nextShapeKey = JSON.stringify(nextShape);
  const nextProfileKey = JSON.stringify(input.deviceProfile);
  if (runtime.shapeKey !== nextShapeKey || runtime.screenshotUrl !== input.screenshotUrl || runtime.profileKey !== nextProfileKey) {
    const screenMetrics = getProceduralDeviceScreenMetrics(nextShape);
    const screenshotTexture = await createProceduralScreenshotTexture(
      input.screenshotUrl,
      input.imageLoader,
      screenMetrics
    );
    rebuildProceduralDeviceGroup(runtime.deviceGroup, {
      shape: nextShape,
      profile: input.deviceProfile,
      screenshotTexture,
      includeScreen: true,
    });
    runtime.shapeKey = nextShapeKey;
    runtime.screenshotUrl = input.screenshotUrl;
    runtime.profileKey = nextProfileKey;
  }

  applyProceduralDeviceTransform(
    runtime.deviceGroup,
    resolveProceduralDeviceRotation(input.heroPhonePose),
    getResolvedDeviceLocation(input.heroPhoneLocation)
  );

  runtime.renderer.render(
    runtime.scene,
    getProceduralActiveCamera(
      resolveProceduralCameraMode(input.heroCameraMode ?? DEFAULT_PROCEDURAL_CAMERA_MODE),
      runtime.perspectiveCamera,
      runtime.orthographicCamera
    )
  );

  return runtime.sceneCanvas;
}

function createHeroRuntime(sceneWidth: number, height: number): HeroRuntime {
  const sceneCanvas = document.createElement('canvas');
  sceneCanvas.width = sceneWidth;
  sceneCanvas.height = height;
  const renderer = new THREE.WebGLRenderer({
    canvas: sceneCanvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(sceneWidth, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const lights = createDefaultProceduralLights(scene);

  const perspectiveCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 5000);
  const orthographicCamera = new THREE.OrthographicCamera(-240, 240, 240, -240, 0.1, 5000);
  const deviceGroup = createProceduralDeviceGroup({
    includeScreen: true,
  });
  scene.add(deviceGroup);

  return {
    sceneCanvas,
    renderer,
    scene,
    perspectiveCamera,
    orthographicCamera,
    deviceGroup,
    keyLight: lights.keyLight,
    screenshotUrl: null,
    shapeKey: null,
    profileKey: null,
  };
}

function disposeHeroScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  scene.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => disposeMaterial(material));
    } else if (mesh.material) {
      disposeMaterial(mesh.material);
    }
  });
  renderer.dispose();
}

function disposeHeroRuntime(runtime: HeroRuntime): void {
  disposeHeroScene(runtime.scene, runtime.renderer);
}

function disposeMaterial(material: THREE.Material): void {
  const textureMaterial = material as THREE.MeshBasicMaterial & { map?: THREE.Texture | null };
  textureMaterial.map?.dispose();
  material.dispose();
}
