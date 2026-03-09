import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  ScreenshotDialogStartPayload,
  ScreenshotPresetConfig,
  ScreenshotPresetMap,
} from '../components/organisms/ScreenshotsDialog';
import {
  fetchScreenshotPresets,
  generateScreenshot,
  readFileAsBase64,
  saveScreenshotPreset,
} from '../services/screenshotService';

export function useScreenshotActions(params: {
  selectedAppId: number | null;
  pushStatus: (message: unknown) => void;
  setScreenshotPresets: Dispatch<SetStateAction<ScreenshotPresetMap>>;
  setIsScreenshotsOpen: Dispatch<SetStateAction<boolean>>;
  setIsGeneratingScreenshot: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    selectedAppId,
    pushStatus,
    setScreenshotPresets,
    setIsScreenshotsOpen,
    setIsGeneratingScreenshot,
  } = params;

  const loadScreenshotPresets = useCallback(async (appId: number) => {
    const payload = await fetchScreenshotPresets(appId);
    const nextPresets: ScreenshotPresetMap = {};
    for (const preset of payload.presets ?? []) {
      nextPresets[preset.store] = {
        palette: preset.palette,
        slotPalettes: preset.slotPalettes,
        slotTitles: preset.slotTitles,
        slotTitleExtraLineColors: preset.slotTitleExtraLineColors,
        slotTitleLineGaps: preset.slotTitleLineGaps,
        slotTitleTypography: preset.slotTitleTypography,
        heroPhonePose: preset.heroPhonePose ?? null,
        heroPhoneShape: preset.heroPhoneShape ?? null,
        heroPhoneLocation: preset.heroPhoneLocation ?? null,
        heroCameraMode: preset.heroCameraMode ?? null,
      };
    }
    setScreenshotPresets(nextPresets);
    return nextPresets;
  }, [setScreenshotPresets]);

  const handleOpenScreenshotsModal = useCallback(() => {
    if (!selectedAppId) return;
    void (async () => {
      try {
        await loadScreenshotPresets(selectedAppId);
      } catch (error) {
        pushStatus(error instanceof Error ? error.message : String(error));
      } finally {
        setIsScreenshotsOpen(true);
      }
    })();
  }, [loadScreenshotPresets, pushStatus, selectedAppId, setIsScreenshotsOpen]);

  const handleSaveScreenshotPreset = useCallback(async (
    store: ScreenshotDialogStartPayload['store'],
    preset: ScreenshotPresetConfig | undefined
  ) => {
    if (!selectedAppId || !preset) return;
    const payload = await saveScreenshotPreset(selectedAppId, store, preset);
    setScreenshotPresets((prev) => ({
      ...prev,
      [payload.preset.store]: {
        palette: payload.preset.palette,
        slotPalettes: payload.preset.slotPalettes,
        slotTitles: payload.preset.slotTitles,
        slotTitleExtraLineColors: payload.preset.slotTitleExtraLineColors,
        slotTitleLineGaps: payload.preset.slotTitleLineGaps,
        slotTitleTypography: payload.preset.slotTitleTypography,
        heroPhonePose: payload.preset.heroPhonePose ?? null,
        heroPhoneShape: payload.preset.heroPhoneShape ?? null,
        heroPhoneLocation: payload.preset.heroPhoneLocation ?? null,
        heroCameraMode: payload.preset.heroCameraMode ?? null,
      },
    }));
  }, [selectedAppId, setScreenshotPresets]);

  const handleGenerateScreenshot = useCallback(async ({
    store,
    locale,
    slot,
    title,
    file,
    renderedImageBase64,
    rendererMode,
    palette,
    slotPalettes,
    slotTitles,
    slotTitleExtraLineColors,
    slotTitleLineGaps,
    titleTypography,
    slotTitleTypography,
    heroPhonePose,
    heroPhoneShape,
    heroPhoneLocation,
    heroCameraMode,
    renderedSlots,
  }: ScreenshotDialogStartPayload) => {
    if (!selectedAppId) return;

    setIsGeneratingScreenshot(true);
    const slotsToGenerate = renderedSlots.length > 0
      ? renderedSlots
      : [{
          slot,
          title,
          renderedImageBase64,
          rendererMode: rendererMode ?? 'canvas-2d',
          palette,
          titleTypography,
          titleExtraLineColors: slotTitleExtraLineColors[slot] ?? [],
          titleLineGap: slotTitleLineGaps[slot] ?? 0,
        }];
    pushStatus(`📸 ${slotsToGenerate.length} screenshot üretimi başlatıldı (${store}/${locale})`);

    try {
      const imageBase64 = await readFileAsBase64(file);
      let successCount = 0;
      for (const renderedSlot of slotsToGenerate) {
        pushStatus(`Slot ${renderedSlot.slot} render output yazılıyor...`);
        try {
          const payload = await generateScreenshot(selectedAppId, store, {
            locale,
            slot: renderedSlot.slot,
            title: renderedSlot.title,
            renderedImageBase64: renderedSlot.renderedImageBase64,
            rendererMode: renderedSlot.rendererMode,
            palette: renderedSlot.palette,
            slotPalettes,
            slotTitles,
            slotTitleExtraLineColors,
            slotTitleLineGaps,
            titleTypography: renderedSlot.titleTypography,
            slotTitleTypography,
            heroPhonePose,
            heroPhoneShape,
            heroPhoneLocation,
            heroCameraMode,
            fileName: file.name,
            mimeType: file.type || 'image/png',
            imageBase64,
          });

          successCount += 1;
          pushStatus(payload.message);
          pushStatus(`Input: ${payload.stagedInputPath}`);
          pushStatus(`Output: ${payload.outputPath}`);
          pushStatus(`Title: ${payload.title}`);
          if (payload.palette) {
            pushStatus(
              `Palette: accent=${payload.palette.accent} dark=${payload.palette.bgDark} ink=${payload.palette.bgInk} cream=${payload.palette.cream} muted=${payload.palette.muted}`
            );
            setScreenshotPresets((prev) => ({
              ...prev,
              [payload.store]: {
                palette: payload.palette,
                slotPalettes,
                slotTitles,
                slotTitleExtraLineColors,
                slotTitleLineGaps,
                slotTitleTypography,
                heroPhonePose: payload.heroPhonePose ?? null,
                heroPhoneShape: payload.heroPhoneShape ?? null,
                heroPhoneLocation: payload.heroPhoneLocation ?? null,
                heroCameraMode: payload.heroCameraMode ?? null,
              },
            }));
          }
          if (payload.renderer) {
            pushStatus(
              `Renderer: ${payload.renderer.template} / ${payload.renderer.engine} (${payload.renderer.canvasSize.width}x${payload.renderer.canvasSize.height})`
            );
          }
        } catch (error) {
          pushStatus(
            `Slot ${renderedSlot.slot} üretim hatası: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      if (successCount > 0) {
        pushStatus(`✅ ${successCount}/${slotsToGenerate.length} screenshot yazıldı.`);
      }
      if (successCount === slotsToGenerate.length) {
        setIsScreenshotsOpen(false);
      }
    } catch (error) {
      pushStatus(`Screenshot üretim hatası: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGeneratingScreenshot(false);
    }
  }, [pushStatus, selectedAppId, setIsGeneratingScreenshot, setIsScreenshotsOpen, setScreenshotPresets]);

  return {
    loadScreenshotPresets,
    handleOpenScreenshotsModal,
    handleSaveScreenshotPreset,
    handleGenerateScreenshot,
  };
}
