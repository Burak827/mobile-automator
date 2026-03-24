import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  ScreenshotDialogStartPayload,
  ScreenshotPresetConfig,
  ScreenshotPresetMap,
  ScreenshotTitleTranslationGeneratePayload,
  ScreenshotTitleTranslationsMap,
} from '../components/organisms/ScreenshotsDialog';
import type { ScreenshotUploadBatchPayload } from '../types';
import {
  fetchScreenshotPresets,
  fetchScreenshotUploadBatches,
  fetchScreenshotTitleTranslations,
  generateScreenshot,
  saveScreenshotPreset,
  saveScreenshotTitleTranslations,
} from '../services/screenshotService';

function normalizeScreenshotTitleTranslationLocale(locale: string): string {
  return locale.trim().replace(/_/g, '-');
}

function getScreenshotTitleTranslationLocalePriority(locale: string): number {
  return locale.includes('_') ? 0 : 1;
}

function mergeScreenshotTitleTranslationEntries(
  entries: Array<[string, Partial<Record<number, string>> | Partial<Record<1 | 2 | 3 | 4 | 5 | 6, string>>]>
): ScreenshotTitleTranslationsMap {
  return [...entries]
    .sort(
      ([leftLocale], [rightLocale]) =>
        getScreenshotTitleTranslationLocalePriority(leftLocale) -
        getScreenshotTitleTranslationLocalePriority(rightLocale)
    )
    .reduce((acc, [locale, slotTitles]) => {
    const normalizedLocale = normalizeScreenshotTitleTranslationLocale(locale);
    if (!normalizedLocale) return acc;
    acc[normalizedLocale] = {
      ...(acc[normalizedLocale] ?? {}),
      ...(slotTitles ?? {}),
    };
    return acc;
  }, {} as ScreenshotTitleTranslationsMap);
}

export function useScreenshotActions(params: {
  selectedAppId: number | null;
  pushStatus: (message: unknown) => void;
  setScreenshotPresets: Dispatch<SetStateAction<ScreenshotPresetMap>>;
  setScreenshotTitleTranslations: Dispatch<SetStateAction<ScreenshotTitleTranslationsMap>>;
  setScreenshotUploadBatches: Dispatch<SetStateAction<ScreenshotUploadBatchPayload[]>>;
  setIsScreenshotsOpen: Dispatch<SetStateAction<boolean>>;
  setIsGeneratingScreenshot: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    selectedAppId,
    pushStatus,
    setScreenshotPresets,
    setScreenshotTitleTranslations,
    setScreenshotUploadBatches,
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
        slotTitleTopPaddings: preset.slotTitleTopPaddings,
        slotTitleCenters: preset.slotTitleCenters,
        slotTitleTypography: preset.slotTitleTypography,
        slotBackgroundSettings: preset.slotBackgroundSettings,
        heroPhonePose: preset.heroPhonePose ?? null,
        heroPhoneShape: preset.heroPhoneShape ?? null,
        heroPhoneLocation: preset.heroPhoneLocation ?? null,
        heroKeyLightPosition: preset.heroKeyLightPosition ?? null,
        heroKeyLightSettings: preset.heroKeyLightSettings ?? null,
        slotSbeSettings: preset.slotSbeSettings,
        heroCameraMode: preset.heroCameraMode ?? null,
        heroCameraSettings: preset.heroCameraSettings ?? null,
      };
    }
    setScreenshotPresets(nextPresets);
    return nextPresets;
  }, [setScreenshotPresets]);

  const loadScreenshotTitleTranslations = useCallback(async (appId: number) => {
    const payload = await fetchScreenshotTitleTranslations(appId);
    const nextTranslations = mergeScreenshotTitleTranslationEntries(
      (payload.translations ?? []).map((entry) => [entry.locale, entry.slotTitles ?? {}])
    );
    setScreenshotTitleTranslations(nextTranslations);
    return nextTranslations;
  }, [setScreenshotTitleTranslations]);

  const loadScreenshotUploadBatches = useCallback(async (appId: number) => {
    const payload = await fetchScreenshotUploadBatches(appId);
    const nextBatches = payload.batches ?? [];
    setScreenshotUploadBatches(nextBatches);
    return nextBatches;
  }, [setScreenshotUploadBatches]);

  const handleOpenScreenshotsModal = useCallback(() => {
    if (!selectedAppId) return;
    void (async () => {
      try {
        await Promise.all([
          loadScreenshotPresets(selectedAppId),
          loadScreenshotTitleTranslations(selectedAppId),
          loadScreenshotUploadBatches(selectedAppId),
        ]);
      } catch (error) {
        pushStatus(error instanceof Error ? error.message : String(error));
      } finally {
        setIsScreenshotsOpen(true);
      }
    })();
  }, [loadScreenshotPresets, loadScreenshotTitleTranslations, loadScreenshotUploadBatches, pushStatus, selectedAppId, setIsScreenshotsOpen]);

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
        slotTitleTopPaddings: payload.preset.slotTitleTopPaddings,
        slotTitleCenters: payload.preset.slotTitleCenters,
        slotTitleTypography: payload.preset.slotTitleTypography,
        slotBackgroundSettings: payload.preset.slotBackgroundSettings,
        heroPhonePose: payload.preset.heroPhonePose ?? null,
        heroPhoneShape: payload.preset.heroPhoneShape ?? null,
        heroPhoneLocation: payload.preset.heroPhoneLocation ?? null,
        heroKeyLightPosition: payload.preset.heroKeyLightPosition ?? null,
        heroKeyLightSettings: payload.preset.heroKeyLightSettings ?? null,
        slotSbeSettings: payload.preset.slotSbeSettings,
        heroCameraMode: payload.preset.heroCameraMode ?? null,
        heroCameraSettings: payload.preset.heroCameraSettings ?? null,
      },
    }));
  }, [selectedAppId, setScreenshotPresets]);

  const handleSaveScreenshotTitleTranslations = useCallback(async (
    translations: ScreenshotTitleTranslationsMap
  ) => {
    if (!selectedAppId) return;
    const normalizedTranslations = mergeScreenshotTitleTranslationEntries(
      Object.entries(translations)
    );
    const payload = await saveScreenshotTitleTranslations(
      selectedAppId,
      normalizedTranslations as Record<string, Record<number, string>>
    );
    setScreenshotTitleTranslations(
      mergeScreenshotTitleTranslationEntries(
        (payload.translations ?? []).map((entry) => [entry.locale, entry.slotTitles ?? {}])
      )
    );
  }, [selectedAppId, setScreenshotTitleTranslations]);

  const handleGenerateScreenshotTitleTranslations = useCallback(async (
    payload: ScreenshotTitleTranslationGeneratePayload
  ) => {
    if (!selectedAppId) return undefined;

    pushStatus(
      `✨ Screenshot title çevirileri oluşturuluyor (${payload.locales.length} hedef locale, kaynak: ${payload.sourceLocale})`
    );
    pushStatus(`Doğrulama: ${(payload.verify ?? true) ? 'Açık' : 'Kapalı'}`);
    if (payload.provider) {
      pushStatus(`AI Engine: ${payload.provider === 'anthropic' ? 'Claude Opus' : 'ChatGPT'}`);
    }

    const response = await fetch(
      `/api/apps/${selectedAppId}/screenshots/generate-title-translations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      let message = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errBody);
        if (parsed.error) message = parsed.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Title translation stream okunamadı.');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const nextTranslations: ScreenshotTitleTranslationsMap = {
      [payload.sourceLocale]: payload.sourceTitles,
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }

        const type = event.type as string;
        if (type === 'start') {
          pushStatus(`${event.totalLocales} hedef locale için screenshot title çevirisi başlayacak`);
        } else if (type === 'progress') {
          pushStatus(`  ${event.locale}: slot ${event.slot} çevrildi`);
        } else if (type === 'locale_done') {
          const locale = typeof event.locale === 'string' ? event.locale.trim() : '';
          const slotTitles =
            event.slotTitles && typeof event.slotTitles === 'object'
              ? (event.slotTitles as Record<number, string>)
              : {};
          if (locale) {
            nextTranslations[locale] = slotTitles;
            pushStatus(`✓ ${locale}: screenshot title çevirileri hazır`);
          }
        } else if (type === 'error') {
          pushStatus(`✗ ${event.locale}/slot-${event.slot}: ${event.error}`);
        } else if (type === 'verify_start') {
          pushStatus(`🔎 Verify başladı (${event.totalChecks} alan)`);
        } else if (type === 'verify_done') {
          const failed = Array.isArray(event.failed) ? event.failed : [];
          if (failed.length === 0) {
            pushStatus('✅ Verify tamamlandı: tüm screenshot title alanları doğrulandı.');
          } else {
            pushStatus(`⚠ Verify tamamlandı: ${failed.length} screenshot title alanı doğrulanamadı.`);
          }
        } else if (type === 'done') {
          pushStatus(`✨ Screenshot title çeviri tamamlandı (${event.translatedLocales} locale)`);
        } else if (type === 'fatal') {
          pushStatus(`Kritik hata: ${event.error}`);
        }
      }
    }

    setScreenshotTitleTranslations((prev) =>
      mergeScreenshotTitleTranslationEntries([
        ...Object.entries(prev),
        ...Object.entries(nextTranslations),
      ])
    );
    return nextTranslations;
  }, [pushStatus, selectedAppId, setScreenshotTitleTranslations]);

  const handleGenerateScreenshot = useCallback(async ({
    store,
    iosDeviceFamily,
    locale,
    slot,
    title,
    renderedImageBase64,
    rendererMode,
    palette,
    slotPalettes,
    slotTitles,
    slotTitleExtraLineColors,
    slotTitleLineGaps,
    slotTitleTopPaddings,
    slotTitleCenters,
    titleTypography,
    slotTitleTypography,
    slotBackgroundSettings,
    heroPhonePose,
    heroPhoneShape,
    heroPhoneLocation,
    heroKeyLightPosition,
    heroKeyLightSettings,
    slotSbeSettings,
    heroCameraMode,
    heroCameraSettings,
    renderedSlots,
    closeWhenDone = true,
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
          titleTopPadding: slotTitleTopPaddings[slot] ?? 0,
          titleCenter: slotTitleCenters[slot] ?? false,
        }];
    pushStatus(
      `📸 ${slotsToGenerate.length} screenshot üretimi başlatıldı (${store}${iosDeviceFamily ? `/${iosDeviceFamily}` : ''}/${locale})`
    );

    try {
      let successCount = 0;
      for (const renderedSlot of slotsToGenerate) {
        pushStatus(`Slot ${renderedSlot.slot} render output yazılıyor...`);
        try {
          const slotSourceImageBase64 =
            renderedSlot.sourceImageBase64 ??
            renderedSlot.renderedImageBase64 ??
            null;
          if (!slotSourceImageBase64) {
            throw new Error(`Slot ${renderedSlot.slot} için kaynak görsel bulunamadı.`);
          }

          const payload = await generateScreenshot(selectedAppId, store, {
            iosDeviceFamily,
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
            slotTitleTopPaddings,
            slotTitleCenters,
            titleTypography: renderedSlot.titleTypography,
            slotTitleTypography,
            slotBackgroundSettings,
            heroPhonePose,
            heroPhoneShape,
            heroPhoneLocation,
            heroKeyLightPosition,
            heroKeyLightSettings,
            slotSbeSettings,
            heroCameraMode,
            heroCameraSettings,
            fileName: renderedSlot.sourceFileName ?? `slot-${renderedSlot.slot}.png`,
            mimeType: renderedSlot.sourceMimeType || 'image/png',
            imageBase64: slotSourceImageBase64,
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
                slotTitleTopPaddings,
                slotTitleCenters,
                slotTitleTypography,
                slotBackgroundSettings: payload.slotBackgroundSettings ?? slotBackgroundSettings,
                heroPhonePose: payload.heroPhonePose ?? null,
                heroPhoneShape: payload.heroPhoneShape ?? null,
                heroPhoneLocation: payload.heroPhoneLocation ?? null,
                heroKeyLightPosition: payload.heroKeyLightPosition ?? null,
                heroKeyLightSettings: payload.heroKeyLightSettings ?? null,
                slotSbeSettings: payload.slotSbeSettings,
                heroCameraMode: payload.heroCameraMode ?? null,
                heroCameraSettings: payload.heroCameraSettings ?? null,
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
        await loadScreenshotUploadBatches(selectedAppId);
        pushStatus(`✅ ${successCount}/${slotsToGenerate.length} screenshot yazıldı.`);
      }
      if (successCount === slotsToGenerate.length && closeWhenDone) {
        setIsScreenshotsOpen(false);
      }
    } catch (error) {
      pushStatus(`Screenshot üretim hatası: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGeneratingScreenshot(false);
    }
  }, [loadScreenshotUploadBatches, pushStatus, selectedAppId, setIsGeneratingScreenshot, setIsScreenshotsOpen, setScreenshotPresets]);

  return {
    loadScreenshotPresets,
    loadScreenshotTitleTranslations,
    loadScreenshotUploadBatches,
    handleOpenScreenshotsModal,
    handleSaveScreenshotPreset,
    handleSaveScreenshotTitleTranslations,
    handleGenerateScreenshotTitleTranslations,
    handleGenerateScreenshot,
  };
}
