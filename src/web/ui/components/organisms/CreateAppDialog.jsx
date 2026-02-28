import Button from '../atoms/Button.jsx';
import AppConfigFields from '../molecules/AppConfigFields.jsx';
import { useDialogController } from '../../hooks/useDialogController.js';

export default function CreateAppDialog({
  isOpen,
  form,
  localeOptions,
  onClose,
  onChange,
  onSubmit,
}) {
  const dialogRef = useDialogController(isOpen, onClose);

  return (
    <dialog ref={dialogRef} className="rules-dialog">
      <section className="card rules-modal">
        <div className="card-head">
          <h2>Yeni Uygulama</h2>
          <Button type="button" variant="danger" onClick={onClose}>
            Kapat
          </Button>
        </div>

        <form className="panel-form two-col" onSubmit={onSubmit}>
          <AppConfigFields
            value={form}
            localeOptions={localeOptions}
            onChange={onChange}
            sourceLocaleName="createSourceLocale"
          />

          <Button type="submit" variant="primary">
            Kaydet
          </Button>
        </form>
      </section>
    </dialog>
  );
}
