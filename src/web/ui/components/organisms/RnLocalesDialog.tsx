import { useEffect, useState } from "react";
import { useDialogController } from "../../hooks/useDialogController.js";
import Button from "../atoms/Button.js";
import type { StoreId } from "../../types.js";

type Props = {
  isOpen: boolean;
  selectedStore: StoreId;
  isBusy: boolean;
  onClose: () => void;
  onSelectStore: (store: StoreId) => void;
  onExport: () => void;
  onImport: (text: string) => void;
};

export default function RnLocalesDialog({
  isOpen,
  selectedStore,
  isBusy,
  onClose,
  onSelectStore,
  onExport,
  onImport,
}: Props) {
  const dialogRef = useDialogController(isOpen, onClose);
  const [importText, setImportText] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setImportText("");
  }, [isOpen]);

  return (
    <dialog ref={dialogRef} className="generate-dialog">
      <section className="card rules-modal">
        <div className="generate-header">
          <h2>RN locales</h2>
          <div className="modal-actions">
            <Button type="button" variant="danger" onClick={onClose} disabled={isBusy}>
              Kapat
            </Button>
          </div>
        </div>

        <div className="rn-locales-store-list">
          <label className="rn-locales-store-item">
            <input
              type="checkbox"
              checked={selectedStore === "app_store"}
              onChange={(event) => {
                if (!event.target.checked) return;
                onSelectStore("app_store");
              }}
              disabled={isBusy}
            />
            <span>ios</span>
          </label>
          <label className="rn-locales-store-item">
            <input
              type="checkbox"
              checked={selectedStore === "play_store"}
              onChange={(event) => {
                if (!event.target.checked) return;
                onSelectStore("play_store");
              }}
              disabled={isBusy}
            />
            <span>play store</span>
          </label>
        </div>

        <p className="rn-locales-note">
          Export seçili store locale başlıklarını JSON olarak indirir. Import aynı JSON formatını
          okuyup değişiklik kuyruğunu günceller.
        </p>

        <label className="rn-locales-text-wrap">
          JSON
          <textarea
            className="rn-locales-textarea"
            placeholder='{"locales": {"en": {"app_name":"Lineup Coach","CFBundleDisplayName":"Lineup Coach","CFBundleName":"Lineup Coach"}}}'
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            disabled={isBusy}
          />
        </label>

        <div className="generate-footer">
          <span className="generate-footer-info">
            Aktif store: {selectedStore === "app_store" ? "ios" : "play store"}
          </span>
          <div className="generate-footer-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={isBusy || importText.trim().length === 0}
              onClick={() => onImport(importText)}
            >
              Import
            </Button>
            <Button type="button" variant="primary" disabled={isBusy} onClick={onExport}>
              Export
            </Button>
          </div>
        </div>
      </section>
    </dialog>
  );
}
