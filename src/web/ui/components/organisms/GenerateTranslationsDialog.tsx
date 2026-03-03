import { useCallback, useEffect, useMemo, useState } from "react";
import { useDialogController } from "../../hooks/useDialogController.js";
import Button from "../atoms/Button.js";
import type { StoreId } from "../../types.js";

type GenerateMode = "generate_missing" | "update_existing";

const IOS_FIELDS = [
  { id: "appName", label: "App Name" },
  { id: "subtitle", label: "Subtitle" },
  { id: "description", label: "Description" },
  { id: "keywords", label: "Keywords" },
  { id: "promotionalText", label: "Promotional Text" },
  { id: "whatsNew", label: "What's New" },
] as const;

const PLAY_FIELDS = [
  { id: "title", label: "Title" },
  { id: "shortDescription", label: "Short Description" },
  { id: "fullDescription", label: "Full Description" },
] as const;

type Props = {
  isOpen: boolean;
  store: StoreId;
  missingLocalesByStore: Record<StoreId, string[]>;
  existingLocalesByStore: Record<StoreId, string[]>;
  sourceLocale: string;
  canGenerateIos: boolean;
  canGeneratePlay: boolean;
  onStoreChange: (store: StoreId) => void;
  onClose: () => void;
  onStart: (payload: {
    store: StoreId;
    mode: GenerateMode;
    selectedLocales: string[];
    selectedFields: string[];
    masterPrompt: string;
    verify: boolean;
  }) => void;
  isRunning: boolean;
};

const STORE_LABEL: Record<StoreId, string> = {
  app_store: "App Store",
  play_store: "Play Store",
};

export default function GenerateTranslationsDialog({
  isOpen,
  store,
  missingLocalesByStore,
  existingLocalesByStore,
  sourceLocale,
  canGenerateIos,
  canGeneratePlay,
  onStoreChange,
  onClose,
  onStart,
  isRunning,
}: Props) {
  const dialogRef = useDialogController(isOpen, onClose);

  const [mode, setMode] = useState<GenerateMode>("generate_missing");
  const [selectedLocales, setSelectedLocales] = useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [masterPrompt, setMasterPrompt] = useState("");
  const [verifyEnabled, setVerifyEnabled] = useState(true);
  const missingLocales = useMemo(() => missingLocalesByStore[store] ?? [], [missingLocalesByStore, store]);
  const existingTargetLocales = useMemo(
    () =>
      (existingLocalesByStore[store] ?? []).filter(
        (locale) => locale.trim() && locale !== sourceLocale
      ),
    [existingLocalesByStore, sourceLocale, store]
  );
  const fields = useMemo(
    () => (store === "app_store" ? IOS_FIELDS : PLAY_FIELDS),
    [store]
  );

  // Reset selections when modal opens with new data or selected store changes.
  useEffect(() => {
    if (isOpen) {
      setMode("generate_missing");
      setSelectedLocales(new Set(missingLocales));
      setSelectedFields(new Set(fields.map((field) => field.id)));
      setMasterPrompt("");
      setVerifyEnabled(true);
    }
  }, [fields, isOpen, missingLocales, store]);

  const toggleLocale = useCallback((locale: string) => {
    setSelectedLocales((prev) => {
      const next = new Set(prev);
      if (next.has(locale)) {
        next.delete(locale);
      } else {
        next.add(locale);
      }
      return next;
    });
  }, []);

  const selectAllLocales = useCallback(() => {
    setSelectedLocales(new Set(missingLocales));
  }, [missingLocales]);

  const clearLocales = useCallback(() => {
    setSelectedLocales(new Set());
  }, []);

  const toggleField = useCallback((fieldId: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  }, []);

  const selectAllFields = useCallback(() => {
    setSelectedFields(new Set(fields.map((field) => field.id)));
  }, [fields]);

  const clearFields = useCallback(() => {
    setSelectedFields(new Set());
  }, []);

  const selectedLocaleCount = useMemo(
    () => missingLocales.filter((locale) => selectedLocales.has(locale)).length,
    [missingLocales, selectedLocales]
  );
  const selectedFieldCount = useMemo(
    () => fields.filter((field) => selectedFields.has(field.id)).length,
    [fields, selectedFields]
  );

  const canStart =
    selectedFieldCount > 0 &&
    (mode === "generate_missing"
      ? selectedLocaleCount > 0
      : existingTargetLocales.length > 0);

  const handleStart = useCallback(() => {
    const fieldIds = fields
      .filter((field) => selectedFields.has(field.id))
      .map((field) => field.id);
    if (fieldIds.length === 0) return;

    const locales =
      mode === "generate_missing"
        ? missingLocales.filter((locale) => selectedLocales.has(locale))
        : [];
    if (mode === "generate_missing" && locales.length === 0) return;
    if (mode === "update_existing" && existingTargetLocales.length === 0) return;

    onStart({
      store,
      mode,
      selectedLocales: locales,
      selectedFields: fieldIds,
      masterPrompt: masterPrompt.trim(),
      verify: verifyEnabled,
    });
  }, [
    existingTargetLocales.length,
    fields,
    masterPrompt,
    missingLocales,
    mode,
    onStart,
    selectedFields,
    selectedLocales,
    store,
    verifyEnabled,
  ]);

  return (
    <dialog ref={dialogRef} className="generate-dialog">
      <section className="card rules-modal">
        <div className="generate-header">
          <h2>✨ {STORE_LABEL[store]} Çevirileri</h2>
          <div className="modal-actions">
            <Button type="button" variant="danger" onClick={onClose} disabled={isRunning}>
              Kapat
            </Button>
          </div>
        </div>

        <div className="generate-store-toggle">
          <Button
            type="button"
            variant={store === "app_store" ? "primary" : "ghost"}
            onClick={() => onStoreChange("app_store")}
            disabled={isRunning || !canGenerateIos}
            title={canGenerateIos ? "App Store locale üretimi" : "ASC APP ID yok"}
          >
            ✨ Gen iOS
          </Button>
          <Button
            type="button"
            variant={store === "play_store" ? "primary" : "ghost"}
            onClick={() => onStoreChange("play_store")}
            disabled={isRunning || !canGeneratePlay}
            title={canGeneratePlay ? "Play Store locale üretimi" : "Android package name yok"}
          >
            ✨ Gen Play
          </Button>
        </div>

        <div className="generate-mode-toggle">
          <Button
            type="button"
            variant={mode === "generate_missing" ? "primary" : "ghost"}
            onClick={() => setMode("generate_missing")}
            disabled={isRunning}
          >
            Eksik Locale Üret
          </Button>
          <Button
            type="button"
            variant={mode === "update_existing" ? "primary" : "ghost"}
            onClick={() => setMode("update_existing")}
            disabled={isRunning}
          >
            Field Update
          </Button>
        </div>

        <label className="generate-verify-check">
          <input
            type="checkbox"
            checked={verifyEnabled}
            onChange={(event) => setVerifyEnabled(event.target.checked)}
            disabled={isRunning}
          />
          Verify
        </label>

        <div className="generate-select-actions">
          <Button type="button" variant="ghost" onClick={selectAllFields} disabled={isRunning}>
            Tüm Field
          </Button>
          <Button type="button" variant="ghost" onClick={clearFields} disabled={isRunning}>
            Field Temizle
          </Button>
        </div>

        <div className="generate-field-list">
          {fields.map((field) => (
            <div key={field.id} className="generate-field-item">
              <input
                type="checkbox"
                id={`gen-field-${store}-${field.id}`}
                checked={selectedFields.has(field.id)}
                onChange={() => toggleField(field.id)}
                disabled={isRunning}
              />
              <label htmlFor={`gen-field-${store}-${field.id}`}>{field.label}</label>
            </div>
          ))}
        </div>

        {mode === "generate_missing" ? (
          missingLocales.length === 0 ? (
            <p>Bu store için üretilecek eksik locale kalmadı.</p>
          ) : (
            <>
              <div className="generate-select-actions">
                <Button type="button" variant="ghost" onClick={selectAllLocales} disabled={isRunning}>
                  Tüm Locale
                </Button>
                <Button type="button" variant="ghost" onClick={clearLocales} disabled={isRunning}>
                  Locale Temizle
                </Button>
              </div>

              <div className="generate-locale-list">
                {missingLocales.map((locale) => (
                  <div key={locale} className="generate-locale-item">
                    <input
                      type="checkbox"
                      id={`gen-${store}-${locale}`}
                      checked={selectedLocales.has(locale)}
                      onChange={() => toggleLocale(locale)}
                      disabled={isRunning}
                    />
                    <label htmlFor={`gen-${store}-${locale}`}>{locale}</label>
                  </div>
                ))}
              </div>
            </>
          )
        ) : (
          <p className="generate-mode-info">
            Field Update modu: kaynağın ({sourceLocale}) dışındaki mevcut {existingTargetLocales.length} locale güncellenecek.
          </p>
        )}

        <div className="generate-prompt-section">
          <label htmlFor="master-prompt">
            Master Prompt (Opsiyonel)
            <textarea
              id="master-prompt"
              className="generate-master-prompt"
              placeholder="Örn: Resmi/formal ton kullan, marka adını çevirme, kısa ve öz yaz..."
              value={masterPrompt}
              onChange={(e) => setMasterPrompt(e.target.value)}
              disabled={isRunning}
            />
          </label>
        </div>

        <div className="generate-footer">
          <span className="generate-footer-info">
            {mode === "generate_missing"
              ? `${selectedLocaleCount} / ${missingLocales.length} locale · ${selectedFieldCount} / ${fields.length} field seçili`
              : `${selectedFieldCount} / ${fields.length} field seçili · ${existingTargetLocales.length} locale güncellenecek`}
          </span>
          <div className="generate-footer-actions">
            <Button
              type="button"
              variant="primary"
              onClick={handleStart}
              disabled={isRunning || !canStart}
            >
              {isRunning ? "Çevriliyor..." : "Başlat"}
            </Button>
          </div>
        </div>
      </section>
    </dialog>
  );
}
