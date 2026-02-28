import Button from '../atoms/Button';
import AppConfigFields from '../molecules/AppConfigFields';
import { useDialogController } from '../../hooks/useDialogController';
import type { FormEvent } from 'react';
import type { AppConfigField, AppConfigForm, LocaleCatalogEntry } from '../../types';

type Props = {
  isOpen: boolean;
  form: AppConfigForm;
  localeOptions: LocaleCatalogEntry[];
  onClose: () => void;
  onChange: (field: AppConfigField, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function CreateAppDialog({
  isOpen,
  form,
  localeOptions,
  onClose,
  onChange,
  onSubmit,
}: Props) {
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
