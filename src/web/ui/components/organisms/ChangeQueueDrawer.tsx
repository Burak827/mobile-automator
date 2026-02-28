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
  isConsoleExpanded: boolean;
  changes: PendingStoreChange[];
  onToggle: () => void;
  onClear: () => void;
  onApplyStore?: (store: StoreId) => void;
  onApply: () => void;
};

export default function ChangeQueueDrawer({
  isOpen,
  isConsoleExpanded,
  changes,
  onToggle,
  onClear,
  onApplyStore,
  onApply,
}: Props) {
  const count = Array.isArray(changes) ? changes.length : 0;
  const iosCount = Array.isArray(changes) ? changes.filter((c) => c.store === 'app_store').length : 0;
  const playCount = Array.isArray(changes) ? changes.filter((c) => c.store === 'play_store').length : 0;
  const drawerClass = `changes-drawer ${isOpen ? 'open' : 'closed'} ${
    isConsoleExpanded ? 'console-expanded' : 'console-collapsed'
  }`;

  return (
    <>
      <button
        type="button"
        className={`changes-drawer-toggle ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
      >
        {isOpen ? '>' : '<'} {count}
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
          <Button type="button" variant="ghost" onClick={onClear} disabled={count === 0}>
            Temizle
          </Button>
          <Button type="button" variant="ghost" onClick={() => onApplyStore?.('app_store')} disabled={iosCount === 0}>
            iOS Güncelle ({iosCount})
          </Button>
          <Button type="button" variant="ghost" onClick={() => onApplyStore?.('play_store')} disabled={playCount === 0}>
            Play Güncelle ({playCount})
          </Button>
          <Button type="button" variant="primary" onClick={onApply} disabled={count === 0}>
            Güncelle
          </Button>
        </div>
      </aside>
    </>
  );
}
