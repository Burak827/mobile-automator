import { useCallback, useEffect, useMemo, useState } from "react";
import { useDialogController } from "../../hooks/useDialogController.js";
import Button from "../atoms/Button.js";
import type { StoreId } from "../../types.js";

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
  onClose: () => void;
  onStart: (store: StoreId, fields: string[], masterPrompt: string) => void;
  isRunning: boolean;
  iosLocales: string[];
  playLocales: string[];
  sourceLocale: string;
};

export default function FieldUpdaterDialog({
  isOpen,
  onClose,
  onStart,
  isRunning,
  iosLocales,
  playLocales,
  sourceLocale,
}: Props) {
  const dialogRef = useDialogController(isOpen, onClose);

  const [store, setStore] = useState<StoreId>("app_store");
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [masterPrompt, setMasterPrompt] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelectedFields(new Set());
      setMasterPrompt("");
    }
  }, [isOpen]);

  // Reset field selection when store changes
  useEffect(() => {
    setSelectedFields(new Set());
  }, [store]);

  const fields = store === "app_store" ? IOS_FIELDS : PLAY_FIELDS;

  const targetLocaleCount = useMemo(() => {
    const locales = store === "app_store" ? iosLocales : playLocales;
    return locales.filter((l) => l !== sourceLocale).length;
  }, [store, iosLocales, playLocales, sourceLocale]);

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

  const handleStart = useCallback(() => {
    const chosen = fields.filter((f) => selectedFields.has(f.id)).map((f) => f.id);
    if (chosen.length === 0) return;
    onStart(store, chosen, masterPrompt.trim());
  }, [fields, selectedFields, store, masterPrompt, onStart]);

  const selectedCount = selectedFields.size;

  return (
    <dialog ref={dialogRef} className="generate-dialog">
      <section className="card rules-modal">
        <div className="generate-header">
          <h2>Field Updater</h2>
          <div className="modal-actions">
            <Button type="button" variant="danger" onClick={onClose} disabled={isRunning}>
              Kapat
            </Button>
          </div>
        </div>

        <div className="field-updater-store-toggle">
          <button
            type="button"
            className={store === "app_store" ? "active" : ""}
            onClick={() => setStore("app_store")}
            disabled={isRunning}
          >
            iOS
          </button>
          <button
            type="button"
            className={store === "play_store" ? "active" : ""}
            onClick={() => setStore("play_store")}
            disabled={isRunning}
          >
            Play Store
          </button>
        </div>

        <div className="field-updater-fields">
          {fields.map((f) => (
            <div key={f.id} className="field-updater-field-item">
              <input
                type="checkbox"
                id={`fu-${f.id}`}
                checked={selectedFields.has(f.id)}
                onChange={() => toggleField(f.id)}
                disabled={isRunning}
              />
              <label htmlFor={`fu-${f.id}`}>{f.label}</label>
            </div>
          ))}
        </div>

        <div className="generate-prompt-section">
          <label htmlFor="fu-master-prompt">
            Master Prompt (Opsiyonel)
            <textarea
              id="fu-master-prompt"
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
            {selectedCount} field seçili · {targetLocaleCount} locale güncellenecek
          </span>
          <div className="generate-footer-actions">
            <Button
              type="button"
              variant="primary"
              onClick={handleStart}
              disabled={isRunning || selectedCount === 0 || targetLocaleCount === 0}
            >
              {isRunning ? "Çevriliyor..." : "Başlat"}
            </Button>
          </div>
        </div>
      </section>
    </dialog>
  );
}
