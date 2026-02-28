import SourceLocaleSelect from '../atoms/SourceLocaleSelect.jsx';

const IOS_FIELD_ORDER = [
  'appName',
  'subtitle',
  'description',
  'keywords',
  'promotionalText',
  'whatsNew',
];

const PLAY_FIELD_ORDER = ['title', 'shortDescription', 'fullDescription'];

const FIELD_LABELS = {
  appName: 'App Name',
  subtitle: 'Subtitle',
  description: 'Description',
  keywords: 'Keywords',
  promotionalText: 'Promotional Text',
  whatsNew: "What's New",
  title: 'Title',
  shortDescription: 'Short Description',
  fullDescription: 'Full Description',
};

const LONG_TEXT_FIELDS = new Set([
  'description',
  'promotionalText',
  'whatsNew',
  'fullDescription',
  'shortDescription',
]);

function toText(value) {
  return typeof value === 'string' ? value : '';
}

function computeByteLength(value) {
  return new TextEncoder().encode(value || '').length;
}

function formatRuleHint(rule, currentValue) {
  if (!rule) return 'Kural bilgisi yok.';

  const unit = rule.unit || 'chars';
  const minText = typeof rule.minChars === 'number' ? `${rule.minChars}` : 'belirtilmedi';
  const maxText =
    typeof rule.maxChars === 'number' ? `${rule.maxChars} ${unit}` : 'belirtilmedi';
  const saveText = rule.requiredForSave ? 'kayıt: zorunlu' : 'kayıt: opsiyonel';
  const publishText = rule.requiredForPublish ? 'yayın: zorunlu' : 'yayın: opsiyonel';
  const count =
    unit === 'bytes' ? computeByteLength(currentValue) : (currentValue || '').length;

  return `${saveText} | ${publishText} | min: ${minText} | max: ${maxText} | mevcut: ${count} ${unit}`;
}

function readStoreFieldValues(store, detail) {
  if (store === 'app_store') {
    const appInfo = detail?.appInfo ?? {};
    const versionLocalization = detail?.versionLocalization ?? {};
    return {
      appName: toText(appInfo.name),
      subtitle: toText(appInfo.subtitle),
      description: toText(versionLocalization.description),
      keywords: toText(versionLocalization.keywords),
      promotionalText: toText(versionLocalization.promotionalText),
      whatsNew: toText(versionLocalization.whatsNew),
    };
  }

  const listing = detail?.listing ?? {};
  return {
    title: toText(listing.title),
    shortDescription: toText(listing.shortDescription),
    fullDescription: toText(listing.fullDescription),
  };
}

function StoreFieldList({ store, detail, fieldRules }) {
  const keys = store === 'app_store' ? IOS_FIELD_ORDER : PLAY_FIELD_ORDER;
  const values = readStoreFieldValues(store, detail);

  return (
    <div className="store-fields">
      {keys.map((fieldKey) => {
        const value = values[fieldKey] || '';
        const rule = fieldRules?.[fieldKey];
        const hint = formatRuleHint(rule, value);
        const note = rule?.notes ? String(rule.notes) : '';
        const label = FIELD_LABELS[fieldKey] || fieldKey;
        const maxLength =
          rule?.unit === 'chars' && typeof rule.maxChars === 'number'
            ? rule.maxChars
            : undefined;

        return (
          <label key={`${store}-${fieldKey}`} className="store-field">
            {label}
            {LONG_TEXT_FIELDS.has(fieldKey) ? (
              <textarea readOnly value={value} maxLength={maxLength} />
            ) : (
              <input type="text" readOnly value={value} maxLength={maxLength} />
            )}
            <small className="store-field-hint">{hint}</small>
            {note ? <small className="store-field-note">{note}</small> : null}
          </label>
        );
      })}
    </div>
  );
}

function StoreLocalePanel({
  title,
  store,
  locales,
  selectedLocale,
  sourceLocale,
  detail,
  isLoading,
  storeRule,
  onChangeLocale,
}) {
  const hasLocales = locales.length > 0;
  const fallbackLocale = (sourceLocale || '').trim();
  const selectedValue = selectedLocale || fallbackLocale;
  const selectOptions = hasLocales ? locales : [fallbackLocale];

  return (
    <article className="store-panel card">
      <div className="card-head store-panel-head">
        <h3>{title}</h3>
        <small>{store}</small>
      </div>

      <label>
        Locale
        <SourceLocaleSelect
          name={`${store}-locale`}
          value={selectedValue}
          options={selectOptions}
          required={false}
          onChange={onChangeLocale}
        />
      </label>

      {!hasLocales ? (
        <p>Bu store için sync edilmiş locale bulunamadı.</p>
      ) : null}

      {storeRule?.screenshotRule ? (
        <p className="store-requirement-note">
          Screenshot: {storeRule.screenshotRule.requiredForPublish ? 'publish için zorunlu' : 'opsiyonel'} | minimum {storeRule.screenshotRule.minCount}
        </p>
      ) : null}

      {isLoading ? (
        <p>Locale detayı yükleniyor...</p>
      ) : (
        <StoreFieldList store={store} detail={detail} fieldRules={storeRule?.fields} />
      )}
    </article>
  );
}

export default function StoreLocalePanels({
  sourceLocale,
  storeRules,
  ios,
  play,
  onSelectIosLocale,
  onSelectPlayLocale,
}) {
  const showIos = ios?.visible !== false;
  const showPlay = play?.visible !== false;

  if (!showIos && !showPlay) {
    return (
      <section className="store-panels-empty">
        <p>Store paneli için ASC App ID veya Android Package Name ekleyip Uygula demelisin.</p>
      </section>
    );
  }

  return (
    <section className="store-panels-grid">
      {showIos ? (
        <StoreLocalePanel
          title="iOS"
          store="app_store"
          locales={ios.locales}
          selectedLocale={ios.selectedLocale}
          sourceLocale={sourceLocale}
          detail={ios.detail}
          isLoading={ios.isLoading}
          storeRule={storeRules?.app_store}
          onChangeLocale={onSelectIosLocale}
        />
      ) : null}

      {showPlay ? (
        <StoreLocalePanel
          title="Play Store"
          store="play_store"
          locales={play.locales}
          selectedLocale={play.selectedLocale}
          sourceLocale={sourceLocale}
          detail={play.detail}
          isLoading={play.isLoading}
          storeRule={storeRules?.play_store}
          onChangeLocale={onSelectPlayLocale}
        />
      ) : null}
    </section>
  );
}
