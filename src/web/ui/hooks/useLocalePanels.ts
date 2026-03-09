import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppStoreLocaleDetail, PlayStoreLocaleDetail } from '../types';
import {
  fetchAppStoreLocaleDetail,
  fetchPlayStoreLocaleDetail,
  fetchStoreLocales,
} from '../services/localeService';

type UseLocalePanelsParams = {
  pushStatus: (message: unknown) => void;
  setIosLocales: Dispatch<SetStateAction<string[]>>;
  setPlayLocales: Dispatch<SetStateAction<string[]>>;
  setIosSelectedLocale: Dispatch<SetStateAction<string>>;
  setPlaySelectedLocale: Dispatch<SetStateAction<string>>;
  setIosDetail: Dispatch<SetStateAction<AppStoreLocaleDetail | null>>;
  setPlayDetail: Dispatch<SetStateAction<PlayStoreLocaleDetail | null>>;
  setIsIosLoading: Dispatch<SetStateAction<boolean>>;
  setIsPlayLoading: Dispatch<SetStateAction<boolean>>;
  asAppStoreDetail: (detail: unknown) => AppStoreLocaleDetail | null;
  asPlayStoreDetail: (detail: unknown) => PlayStoreLocaleDetail | null;
  pickDefaultLocale: (sourceLocale: string, locales: string[]) => string;
  toSortedUniqueLocaleList: (locales: string[] | undefined) => string[];
};

export function useLocalePanels({
  pushStatus,
  setIosLocales,
  setPlayLocales,
  setIosSelectedLocale,
  setPlaySelectedLocale,
  setIosDetail,
  setPlayDetail,
  setIsIosLoading,
  setIsPlayLoading,
  asAppStoreDetail,
  asPlayStoreDetail,
  pickDefaultLocale,
  toSortedUniqueLocaleList,
}: UseLocalePanelsParams) {
  const loadIosLocaleDetail = useCallback(async (appId: number, locale: string) => {
    if (!locale) return null;
    const payload = await fetchAppStoreLocaleDetail(appId, locale);
    return asAppStoreDetail(payload?.detail);
  }, [asAppStoreDetail]);

  const loadPlayLocaleDetail = useCallback(async (appId: number, locale: string) => {
    if (!locale) return null;
    const payload = await fetchPlayStoreLocaleDetail(appId, locale);
    return asPlayStoreDetail(payload?.detail);
  }, [asPlayStoreDetail]);

  const loadStorePanels = useCallback(async (appId: number, sourceLocale: string) => {
    setIsIosLoading(true);
    setIsPlayLoading(true);

    try {
      const localesPayload = await fetchStoreLocales(appId);
      const nextIosLocales = toSortedUniqueLocaleList(localesPayload?.appStoreLocales);
      const nextPlayLocales = toSortedUniqueLocaleList(localesPayload?.playStoreLocales);

      const nextIosSelectedLocale = pickDefaultLocale(sourceLocale, nextIosLocales);
      const nextPlaySelectedLocale = pickDefaultLocale(sourceLocale, nextPlayLocales);

      setIosLocales(nextIosLocales);
      setPlayLocales(nextPlayLocales);
      setIosSelectedLocale(nextIosSelectedLocale);
      setPlaySelectedLocale(nextPlaySelectedLocale);

      const [nextIosDetail, nextPlayDetail] = await Promise.all([
        nextIosLocales.includes(nextIosSelectedLocale)
          ? loadIosLocaleDetail(appId, nextIosSelectedLocale).catch(() => null)
          : Promise.resolve(null),
        nextPlayLocales.includes(nextPlaySelectedLocale)
          ? loadPlayLocaleDetail(appId, nextPlaySelectedLocale).catch(() => null)
          : Promise.resolve(null),
      ]);

      setIosDetail(nextIosDetail);
      setPlayDetail(nextPlayDetail);
    } catch (error) {
      setIosLocales([]);
      setPlayLocales([]);
      setIosSelectedLocale('');
      setPlaySelectedLocale('');
      setIosDetail(null);
      setPlayDetail(null);
      pushStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsIosLoading(false);
      setIsPlayLoading(false);
    }
  }, [
    loadIosLocaleDetail,
    loadPlayLocaleDetail,
    pickDefaultLocale,
    pushStatus,
    setIosDetail,
    setIosLocales,
    setIosSelectedLocale,
    setIsIosLoading,
    setIsPlayLoading,
    setPlayDetail,
    setPlayLocales,
    setPlaySelectedLocale,
    toSortedUniqueLocaleList,
  ]);

  return {
    loadIosLocaleDetail,
    loadPlayLocaleDetail,
    loadStorePanels,
  };
}
