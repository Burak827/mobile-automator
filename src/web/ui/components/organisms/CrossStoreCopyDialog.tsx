import { useMemo } from 'react';
import Button from '../atoms/Button';
import { useDialogController } from '../../hooks/useDialogController';

export type CrossStoreCopyDirection = 'ios_to_play' | 'play_to_ios';

export type CrossStoreMappingOption = {
  id: string;
  sourceField: string;
  targetField: string;
  sourceLabel: string;
  targetLabel: string;
};

type Props = {
  isOpen: boolean;
  direction: CrossStoreCopyDirection;
  options: CrossStoreMappingOption[];
  selectedIds: Set<string>;
  isRunning: boolean;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onClose: () => void;
  onStart: () => void;
};

const DIRECTION_LABEL: Record<CrossStoreCopyDirection, string> = {
  ios_to_play: 'iOS → Play Store',
  play_to_ios: 'Play Store → iOS',
};

export default function CrossStoreCopyDialog({
  isOpen,
  direction,
  options,
  selectedIds,
  isRunning,
  onToggle,
  onSelectAll,
  onClear,
  onClose,
  onStart,
}: Props) {
  const dialogRef = useDialogController(isOpen, onClose);
  const selectedCount = useMemo(
    () => options.filter((option) => selectedIds.has(option.id)).length,
    [options, selectedIds]
  );

  return (
    <dialog ref={dialogRef} className="rules-dialog">
      <section className="card rules-modal copy-dialog">
        <div className="card-head">
          <div>
            <h2>{DIRECTION_LABEL[direction]}</h2>
            <p className="copy-dialog-subtitle">
              Hangi alanların birbirine dönüştürüleceğini seç. Seçilmeyen mapping’ler queue’ya eklenmez.
            </p>
          </div>
          <div className="modal-actions">
            <Button type="button" variant="danger" onClick={onClose} disabled={isRunning}>
              Kapat
            </Button>
          </div>
        </div>

        <div className="copy-dialog-actions">
          <Button type="button" variant="ghost" onClick={onSelectAll} disabled={isRunning}>
            Tümünü Seç
          </Button>
          <Button type="button" variant="ghost" onClick={onClear} disabled={isRunning}>
            Temizle
          </Button>
        </div>

        <div className="copy-dialog-list">
          {options.map((option) => (
            <label key={option.id} className="copy-dialog-item">
              <input
                type="checkbox"
                checked={selectedIds.has(option.id)}
                onChange={() => onToggle(option.id)}
                disabled={isRunning}
              />
              <div className="copy-dialog-item-copy">
                <strong>{option.sourceLabel}</strong>
                <span>{option.targetLabel}</span>
              </div>
              <code>
                {option.sourceField} → {option.targetField}
              </code>
            </label>
          ))}
        </div>

        <div className="generate-footer">
          <span className="generate-footer-info">
            {selectedCount} / {options.length} mapping seçili
          </span>
          <div className="generate-footer-actions">
            <Button
              type="button"
              variant="primary"
              onClick={onStart}
              disabled={isRunning || selectedCount === 0}
            >
              {isRunning ? 'Hazırlanıyor...' : 'Hazırla'}
            </Button>
          </div>
        </div>
      </section>
    </dialog>
  );
}
