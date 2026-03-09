import { api } from '../lib/api';
import type {
  ScreenshotGenerateResponse,
  ScreenshotPresetListResponse,
  ScreenshotPresetResponse,
} from '../types';
import type {
  ScreenshotPresetConfig,
} from '../components/organisms/ScreenshotsDialog';
import {
  getScreenshotStoreEndpointSegment,
  type ScreenshotStore,
} from '../../screenshotTemplates/screenshotStores';

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error('Dosya okunamadı.'));
    };
    reader.onload = () => {
      const data = typeof reader.result === 'string' ? reader.result : '';
      const [, base64 = ''] = data.split(',');
      if (!base64) {
        reject(new Error('Dosya base64 formatına çevrilemedi.'));
        return;
      }
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

export async function fetchScreenshotPresets(appId: number): Promise<ScreenshotPresetListResponse> {
  return api<ScreenshotPresetListResponse>(`/api/apps/${appId}/screenshots/presets`);
}

export async function saveScreenshotPreset(
  appId: number,
  store: ScreenshotStore,
  preset: ScreenshotPresetConfig
): Promise<ScreenshotPresetResponse> {
  const endpointSegment = getScreenshotStoreEndpointSegment(store);
  return api<ScreenshotPresetResponse>(`/api/apps/${appId}/screenshots/presets/${endpointSegment}`, {
    method: 'PUT',
    body: JSON.stringify({
      palette: preset.palette,
      slotPalettes: preset.slotPalettes,
      slotTitles: preset.slotTitles,
      slotTitleExtraLineColors: preset.slotTitleExtraLineColors,
      slotTitleLineGaps: preset.slotTitleLineGaps,
      slotTitleTypography: preset.slotTitleTypography,
      heroPhonePose: preset.heroPhonePose,
      heroPhoneShape: preset.heroPhoneShape,
      heroPhoneLocation: preset.heroPhoneLocation,
      heroCameraMode: preset.heroCameraMode,
    }),
  });
}

export async function generateScreenshot(
  appId: number,
  store: ScreenshotStore,
  body: Record<string, unknown>
): Promise<ScreenshotGenerateResponse> {
  const endpointSegment = getScreenshotStoreEndpointSegment(store);
  return api<ScreenshotGenerateResponse>(`/api/apps/${appId}/screenshots/${endpointSegment}/generate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
