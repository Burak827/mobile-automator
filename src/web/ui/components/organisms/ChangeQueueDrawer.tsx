import { useState } from 'react';
import Button from '../atoms/Button';
import type { PendingStoreChange, StoreId } from '../../types';

function formatStoreLabel(store: StoreId): string {
  if (store === 'app_store') return 'iOS';
  if (store === 'play_store') return 'Play';
  return store;
}

function toDisplayValue(value: string): string {
  return value.length > 0 ? value : '(boş)';
}

function formatChangeTitle(change: PendingStoreChange): string {
  if (change.kind === 'locale') {
    return change.action === 'add' ? 'Locale Ekle' : 'Locale Sil';
  }
  return change.field;
}

type Props = {
  isOpen: boolean;
  isBusy: boolean;
  changes: PendingStoreChange[];
  onToggle: () => void;
  onClear: () => void;
  onExport: () => void;
  onImport: (text: string) => void;
  onApplyStore?: (store: StoreId) => void;
  onApply: () => void;
};

export default function ChangeQueueDrawer({
  isOpen,
  isBusy,
  changes,
  onToggle,
  onClear,
  onExport,
  onImport,
  onApplyStore,
  onApply,
}: Props) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const count = Array.isArray(changes) ? changes.length : 0;
  const iosCount = Array.isArray(changes) ? changes.filter((c) => c.store === 'app_store').length : 0;
  const playCount = Array.isArray(changes) ? changes.filter((c) => c.store === 'play_store').length : 0;
  const drawerClass = `changes-drawer ${isOpen ? 'open' : 'closed'}`;

  return (
    <>
      <button
        type="button"
        className={`changes-drawer-toggle ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
      >
        <svg className="drawer-toggle-icon" width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isOpen ? (
            <polyline points="2,2 8,8 2,14" />
          ) : (
            <polyline points="8,2 2,8 8,14" />
          )}
        </svg>
        <span className="drawer-toggle-count">{count}</span>
      </button>

      <aside className={drawerClass}>
        <div className="changes-drawer-head">
          <h3>Kayıt</h3>
          <span>{count}</span>
        </div>

        <div className="changes-drawer-list">
          {count === 0 ? (
            <p>Henüz değişiklik yok. Store alanlarını düzenledikçe burada listelenecek.</p>
          ) : (
            <ul className="change-list">
              {changes.map((entry) => (
                <li key={entry.key} className="change-item">
                  <div className="change-item-head">
                    <strong>{formatStoreLabel(entry.store)}</strong>
                    <span>{entry.locale}</span>
                  </div>
                  <div className="change-field">{formatChangeTitle(entry)}</div>
                  {entry.kind === 'locale' ? (
                    <div className="change-values">
                      <code>{entry.action === 'add' ? 'eklensin' : 'silinsin'}</code>
                    </div>
                  ) : (
                    <div className="change-values">
                      <code>{toDisplayValue(entry.oldValue)}</code>
                      <span>→</span>
                      <code>{toDisplayValue(entry.newValue)}</code>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="changes-drawer-actions">
          <div className="changes-drawer-actions-row">
            <Button type="button" variant="ghost" onClick={onExport} disabled={count === 0 || isBusy}>
              Export
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsImportOpen((prev) => !prev)} disabled={isBusy}>
              {isImportOpen ? 'Import Kapat' : 'Import Aç'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClear} disabled={count === 0 || isBusy}>
              Temizle
            </Button>
            <Button type="button" variant="ghost" onClick={() => onApplyStore?.('app_store')} disabled={iosCount === 0 || isBusy}>
              {isBusy ? 'İşleniyor...' : `iOS Güncelle (${iosCount})`}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onApplyStore?.('play_store')} disabled={playCount === 0 || isBusy}>
              {isBusy ? 'İşleniyor...' : `Play Güncelle (${playCount})`}
            </Button>
            <Button type="button" variant="primary" onClick={onApply} disabled={count === 0 || isBusy}>
              {isBusy ? 'İşleniyor...' : 'Güncelle'}
            </Button>
          </div>

          {isImportOpen ? (
            <div className="changes-drawer-import">
              <label>
                JSON
                <textarea
                  className="changes-drawer-import-textarea"
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder='{"changes":[{"kind":"locale","store":"app_store","locale":"fr","action":"add"}]}'
                  disabled={isBusy}
                />
              </label>
              <Button
                type="button"
                variant="primary"
                disabled={isBusy || importText.trim().length === 0}
                onClick={() => onImport(importText)}
              >
                İçe Aktar
              </Button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
