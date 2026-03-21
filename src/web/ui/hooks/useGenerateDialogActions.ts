import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AIProvider, StoreId } from '../types';

export type GenerateDialogStartPayload = {
  store: StoreId;
  mode: 'generate_missing' | 'update_existing';
  selectedLocales: string[];
  selectedFields: string[];
  masterPrompt: string;
  verify: boolean;
  provider: AIProvider;
};

export function useGenerateDialogActions(params: {
  showIosPanel: boolean;
  showPlayPanel: boolean;
  setGenerateModalStore: Dispatch<SetStateAction<StoreId>>;
  setIsGenerateModalOpen: Dispatch<SetStateAction<boolean>>;
  handleGenerateTranslations: (
    store: StoreId,
    requestLocales: string[],
    masterPrompt: string,
    mode: 'generate_missing' | 'update_existing',
    selectedFields: string[],
    verify: boolean,
    provider: AIProvider
  ) => void;
}) {
  const {
    showIosPanel,
    showPlayPanel,
    setGenerateModalStore,
    setIsGenerateModalOpen,
    handleGenerateTranslations,
  } = params;

  const handleOpenGenerateModal = useCallback(() => {
    if (showIosPanel) {
      setGenerateModalStore('app_store');
    } else if (showPlayPanel) {
      setGenerateModalStore('play_store');
    }
    setIsGenerateModalOpen(true);
  }, [setGenerateModalStore, setIsGenerateModalOpen, showIosPanel, showPlayPanel]);

  const handleStartGenerate = useCallback((payload: GenerateDialogStartPayload) => {
    setIsGenerateModalOpen(false);
    setGenerateModalStore(payload.store);
    const requestLocales = payload.mode === 'generate_missing' ? payload.selectedLocales : [];
    void handleGenerateTranslations(
      payload.store,
      requestLocales,
      payload.masterPrompt,
      payload.mode,
      payload.selectedFields,
      payload.verify,
      payload.provider
    );
  }, [handleGenerateTranslations, setGenerateModalStore, setIsGenerateModalOpen]);

  return {
    handleOpenGenerateModal,
    handleStartGenerate,
  };
}
