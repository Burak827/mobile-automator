import Button from '../atoms/Button.jsx';
import { useDialogController } from '../../hooks/useDialogController.js';

export default function RulesDialog({
  isOpen,
  stores,
  onClose,
  onReload,
}) {
  const dialogRef = useDialogController(isOpen, onClose);

  return (
    <dialog ref={dialogRef} className="rules-dialog">
      <section className="card rules-modal">
        <div className="card-head">
          <h2>Mağaza Kuralları</h2>
          <div className="modal-actions">
            <Button type="button" variant="ghost" onClick={onReload}>
              Yenile
            </Button>
            <Button type="button" variant="danger" onClick={onClose}>
              Kapat
            </Button>
          </div>
        </div>

        <div className="meta-grid">
          {stores.length === 0 ? (
            <p>Kural bilgisi bulunamadı.</p>
          ) : (
            stores.map((store) => (
              <article className="meta-card" key={store.store}>
                <h3>{store.displayName}</h3>
                <p>
                  Locale load: <strong>{store.localeLoadHint}</strong>
                </p>
                <p>
                  Screenshot:{" "}
                  <strong>
                    {store.screenshotRule.requiredForPublish
                      ? 'publish için zorunlu'
                      : 'opsiyonel'}
                  </strong>
                </p>
                <p>{store.screenshotRule.notes}</p>

                <div>
                  {Object.entries(store.fields).map(([field, rule]) => {
                    const unit = rule.unit || 'chars';
                    const saveRequired = rule.requiredForSave ? 'save: required' : 'save: optional';
                    const publishRequired = rule.requiredForPublish
                      ? 'publish: required'
                      : 'publish: optional';
                    const minText =
                      typeof rule.minChars === 'number' ? `min ${rule.minChars}` : 'min n/a';
                    const maxText =
                      typeof rule.maxChars === 'number'
                        ? `max ${rule.maxChars} ${unit}`
                        : 'max n/a';

                    return (
                      <code key={`${store.store}-${field}`}>
                        {field}: {minText}, {maxText} ({saveRequired}, {publishRequired})
                      </code>
                    );
                  })}
                </div>

                <p className="meta-links">
                  {(store.sources || []).map((url) => (
                    <span key={url}>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        {url}
                      </a>
                      <br />
                    </span>
                  ))}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </dialog>
  );
}
