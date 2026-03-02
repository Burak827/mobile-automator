import { useCallback, useEffect, useMemo, useState } from "react";
import { useDialogController } from "../../hooks/useDialogController.js";
import Button from "../atoms/Button.js";
import type { StoreId } from "../../types.js";

type Props = {
  isOpen: boolean;
  store: StoreId;
  missingLocales: string[];
  onClose: () => void;
  onStart: (selectedLocales: string[], masterPrompt: string) => void;
  isRunning: boolean;
};

const STORE_LABEL: Record<StoreId, string> = {
  app_store: "App Store",
  play_store: "Play Store",
};

export default function GenerateTranslationsDialog({
  isOpen,
  store,
  missingLocales,
  onClose,
  onStart,
  isRunning,
}: Props) {
  const dialogRef = useDialogController(isOpen, onClose);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [masterPrompt, setMasterPrompt] = useState("");

  // Reset selections when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setSelected(new Set(missingLocales));
      setMasterPrompt("");
    }
  }, [isOpen, missingLocales]);

  const toggleLocale = useCallback((locale: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(locale)) {
        next.delete(locale);
      } else {
        next.add(locale);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(missingLocales));
  }, [missingLocales]);

  const selectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleStart = useCallback(() => {
    const locales = missingLocales.filter((l) => selected.has(l));
    if (locales.length === 0) return;
    onStart(locales, masterPrompt.trim());
  }, [missingLocales, selected, masterPrompt, onStart]);

  const selectedCount = useMemo(
    () => missingLocales.filter((l) => selected.has(l)).length,
    [missingLocales, selected],
  );

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

        {missingLocales.length === 0 ? (
          <p>Tüm locale&apos;ler zaten mevcut.</p>
        ) : (
          <>
            <div className="generate-select-actions">
              <Button type="button" variant="ghost" onClick={selectAll} disabled={isRunning}>
                Tümünü Seç
              </Button>
              <Button type="button" variant="ghost" onClick={selectNone} disabled={isRunning}>
                Hiçbirini Seçme
              </Button>
            </div>

            <div className="generate-locale-list">
              {missingLocales.map((locale) => (
                <div key={locale} className="generate-locale-item">
                  <input
                    type="checkbox"
                    id={`gen-${locale}`}
                    checked={selected.has(locale)}
                    onChange={() => toggleLocale(locale)}
                    disabled={isRunning}
                  />
                  <label htmlFor={`gen-${locale}`}>{locale}</label>
                </div>
              ))}
            </div>

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
                {selectedCount} / {missingLocales.length} locale seçili
              </span>
              <div className="generate-footer-actions">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleStart}
                  disabled={isRunning || selectedCount === 0}
                >
                  {isRunning ? "Çevriliyor..." : "Başlat"}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </dialog>
  );
}
