import Button from '../atoms/Button';
import AppConfigFields from '../molecules/AppConfigFields';
import type { FormEvent } from 'react';
import type { AppConfigField, AppConfigForm, AppRecord, LocaleCatalogEntry } from '../../types';

type Props = {
  selectedApp: AppRecord | null;
  appConfig: AppConfigForm;
  localeOptions: LocaleCatalogEntry[];
  hasConfigChanges: boolean;
  isApplyingConfig: boolean;
  onChangeConfig: (field: AppConfigField, value: string) => void;
  onSubmitConfig: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteApp: () => void;
};

export default function AppDetailsPanel({
  selectedApp,
  appConfig,
  localeOptions,
  hasConfigChanges,
  isApplyingConfig,
  onChangeConfig,
  onSubmitConfig,
  onDeleteApp,
}: Props) {
  if (!selectedApp) {
    return (
      <section className="card content placeholder-card">
        <h2>Seçili Uygulama</h2>
        <p>Soldan bir uygulama seç veya yeni uygulama oluştur.</p>
      </section>
    );
  }

  return (
    <section className="card content">
      <form className="panel-form config-fields-row" onSubmit={onSubmitConfig}>
        <AppConfigFields
          value={appConfig}
          localeOptions={localeOptions}
          onChange={onChangeConfig}
        />

        <div className="form-submit-row">
          <Button type="submit" variant="primary" disabled={isApplyingConfig}>
            {isApplyingConfig ? 'İşleniyor...' : hasConfigChanges ? 'Uygula' : 'Eşzamanla'}
          </Button>
          <Button type="button" variant="danger" onClick={onDeleteApp}>
            Sil
          </Button>
        </div>
      </form>
    </section>
  );
}
