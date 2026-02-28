import Button from '../atoms/Button.jsx';
import AppConfigFields from '../molecules/AppConfigFields.jsx';

export default function AppDetailsPanel({
  selectedApp,
  appConfig,
  localeOptions,
  hasConfigChanges,
  isApplyingConfig,
  onChangeConfig,
  onSubmitConfig,
  onDeleteApp,
}) {
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
