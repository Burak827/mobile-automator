import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import Button from '../atoms/Button';
import SourceLocaleSelect from '../atoms/SourceLocaleSelect';
import type {
  AppStoreLocaleDetail,
  AppStorePanelState,
  LocaleCatalogEntry,
  PendingValueMap,
  PlayStoreLocaleDetail,
  PlayStorePanelState,
  ScreenshotGroup,
  ScreenshotImage,
  StoreFieldChangePayload,
  StoreFieldRule,
  StoreId,
  StoreLocaleDetail,
  StoreRuleSet,
} from '../../types';

const IOS_FIELD_ORDER = [
  'appName',
  'subtitle',
  'description',
  'keywords',
  'promotionalText',
  'whatsNew',
] as const;

const PLAY_FIELD_ORDER = ['title', 'shortDescription', 'fullDescription'] as const;

type IosFieldKey = (typeof IOS_FIELD_ORDER)[number];
type PlayFieldKey = (typeof PLAY_FIELD_ORDER)[number];
type StoreFieldKey = IosFieldKey | PlayFieldKey;

const FIELD_LABELS: Record<StoreFieldKey, string> = {
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

const LONG_TEXT_FIELDS = new Set<StoreFieldKey>([
  'description',
  'promotionalText',
  'whatsNew',
  'fullDescription',
  'shortDescription',
]);

type FieldValues = Partial<Record<StoreFieldKey, string>>;

function toText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toChangeKey(store: StoreId, locale: string, field: string): string {
  return `${store}::${locale}::${field}`;
}

function computeByteLength(value: string): number {
  return new TextEncoder().encode(value || '').length;
}

function formatRuleHint(rule: StoreFieldRule | undefined, currentValue: string): string {
  if (!rule) return 'Kural bilgisi yok.';

  const unit = rule.unit || 'chars';
  const minText = typeof rule.minChars === 'number' ? `${rule.minChars}` : 'belirtilmedi';
  const maxText = typeof rule.maxChars === 'number' ? `${rule.maxChars} ${unit}` : 'belirtilmedi';
  const saveText = rule.requiredForSave ? 'kayıt: zorunlu' : 'kayıt: opsiyonel';
  const publishText = rule.requiredForPublish ? 'yayın: zorunlu' : 'yayın: opsiyonel';
  const count = unit === 'bytes' ? computeByteLength(currentValue) : currentValue.length;

  return `${saveText} | ${publishText} | min: ${minText} | max: ${maxText} | mevcut: ${count} ${unit}`;
}

function isAppStoreDetail(
  detail: StoreLocaleDetail | null | undefined
): detail is AppStoreLocaleDetail {
  return detail?.store === 'app_store';
}

function isPlayStoreDetail(
  detail: StoreLocaleDetail | null | undefined
): detail is PlayStoreLocaleDetail {
  return detail?.store === 'play_store';
}

function readStoreFieldValues(store: StoreId, detail: StoreLocaleDetail | null): FieldValues {
  if (store === 'app_store') {
    const appInfo = isAppStoreDetail(detail) ? detail.appInfo ?? {} : {};
    const versionLocalization = isAppStoreDetail(detail)
      ? detail.versionLocalization ?? {}
      : {};

    return {
      appName: toText(appInfo.name),
      subtitle: toText(appInfo.subtitle),
      description: toText(versionLocalization.description),
      keywords: toText(versionLocalization.keywords),
      promotionalText: toText(versionLocalization.promotionalText),
      whatsNew: toText(versionLocalization.whatsNew),
    };
  }

  const listing = isPlayStoreDetail(detail) ? detail.listing ?? {} : {};
  return {
    title: toText(listing.title),
    shortDescription: toText(listing.shortDescription),
    fullDescription: toText(listing.fullDescription),
  };
}

type StoreFieldListProps = {
  store: StoreId;
  locale: string;
  detail: StoreLocaleDetail | null;
  fieldRules?: Record<string, StoreFieldRule>;
  pendingValueMap: PendingValueMap;
  onChangeField: (payload: StoreFieldChangePayload) => void;
};

function StoreFieldList({
  store,
  locale,
  detail,
  fieldRules,
  pendingValueMap,
  onChangeField,
}: StoreFieldListProps) {
  const keys: readonly StoreFieldKey[] =
    store === 'app_store' ? IOS_FIELD_ORDER : PLAY_FIELD_ORDER;
  const values = readStoreFieldValues(store, detail);

  return (
    <div className="store-fields">
      {keys.map((fieldKey) => {
        const baseValue = values[fieldKey] || '';
        const changeKey = toChangeKey(store, locale, fieldKey);
        const value = Object.prototype.hasOwnProperty.call(pendingValueMap, changeKey)
          ? pendingValueMap[changeKey]
          : baseValue;
        const rule = fieldRules?.[fieldKey];
        const hint = formatRuleHint(rule, value);
        const note = rule?.notes ? String(rule.notes) : '';
        const label = FIELD_LABELS[fieldKey];
        const maxLength =
          rule?.unit === 'chars' && typeof rule.maxChars === 'number'
            ? rule.maxChars
            : undefined;

        return (
          <label key={`${store}-${fieldKey}`} className="store-field">
            {label}
            {LONG_TEXT_FIELDS.has(fieldKey) ? (
              <textarea
                value={value}
                maxLength={maxLength}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  onChangeField({
                    store,
                    locale,
                    field: fieldKey,
                    originalValue: baseValue,
                    nextValue: event.target.value,
                  })
                }
              />
            ) : (
              <input
                type="text"
                value={value}
                maxLength={maxLength}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onChangeField({
                    store,
                    locale,
                    field: fieldKey,
                    originalValue: baseValue,
                    nextValue: event.target.value,
                  })
                }
              />
            )}
            <small className="store-field-hint">{hint}</small>
            {note ? <small className="store-field-note">{note}</small> : null}
          </label>
        );
      })}
    </div>
  );
}

type ScreenshotFieldProps = {
  screenshots?: ScreenshotGroup[];
};

function ScreenshotField({ screenshots }: ScreenshotFieldProps) {
  const [preview, setPreview] = useState<ScreenshotImage | null>(null);

  if (!screenshots || screenshots.length === 0) return null;

  return (
    <div className="store-field screenshot-section">
      <span>Screenshots</span>
      {screenshots.map((group) => (
        <div key={group.displayType}>
          <div className="screenshot-group-label">{group.displayType}</div>
          <div className="screenshot-grid">
            {group.images.map((img, i) => (
              <img
                key={i}
                className="screenshot-thumb"
                src={img.url}
                width={img.width && img.height ? Math.round((img.width / img.height) * 100) : undefined}
                height={100}
                loading="lazy"
                alt={`${group.displayType} #${i + 1}`}
                onClick={() => setPreview(img)}
              />
            ))}
          </div>
        </div>
      ))}

      {preview ? (
        <dialog className="screenshot-dialog" open onClick={() => setPreview(null)}>
          <div
            className="screenshot-dialog-inner"
            onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
          >
            <img className="screenshot-preview" src={preview.url} alt="Preview" />
            <button
              type="button"
              className="ghost-button"
              onClick={() => setPreview(null)}
            >
              Kapat
            </button>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}

type StoreLocalePanelProps = {
  title: string;
  store: StoreId;
  locales: string[];
  selectedLocale: string;
  sourceLocale: string;
  detail: StoreLocaleDetail | null;
  isLoading: boolean;
  storeRule?: StoreRuleSet;
  localeCatalog: LocaleCatalogEntry[];
  pendingValueMap: PendingValueMap;
  onChangeLocale: (locale: string) => void;
  onDeleteLocale: (locale: string) => void;
  onAddLocale: (locale: string) => void;
  onChangeField: (payload: StoreFieldChangePayload) => void;
};

function StoreLocalePanel({
  title,
  store,
  locales,
  selectedLocale,
  sourceLocale,
  detail,
  isLoading,
  storeRule,
  localeCatalog,
  pendingValueMap,
  onChangeLocale,
  onDeleteLocale,
  onAddLocale,
  onChangeField,
}: StoreLocalePanelProps) {
  const hasLocales = locales.length > 0;
  const fallbackLocale = (sourceLocale || '').trim() || 'en-US';
  const selectOptions = hasLocales ? locales : [fallbackLocale];
  const selectedValue = selectOptions.includes(selectedLocale)
    ? selectedLocale
    : selectOptions[0] || '';
  const addableLocales = useMemo(
    () =>
      localeCatalog
        .filter((entry) => (store === 'app_store' ? entry.iosSupported : entry.androidSupported))
        .map((entry) => entry.locale)
        .filter((locale) => !selectOptions.includes(locale)),
    [localeCatalog, selectOptions, store]
  );
  const [addLocaleValue, setAddLocaleValue] = useState('');

  useEffect(() => {
    const first = addableLocales[0] || '';
    setAddLocaleValue((prev) => (prev && addableLocales.includes(prev) ? prev : first));
  }, [addableLocales]);

  const versionString =
    store === 'app_store' && isAppStoreDetail(detail) && typeof detail.versionString === 'string'
      ? detail.versionString.trim()
      : '';
  const storeMeta = versionString ? `${store} | version: ${versionString}` : store;

  return (
    <article className="store-panel card">
      <div className="store-panel-top">
        <div className="card-head store-panel-head">
          <h3>{title}</h3>
          <small>{storeMeta}</small>
        </div>

        <div className="store-locale-row">
          <span className="store-locale-label">Locale</span>
          <div className="store-locale-actions">
            <div className="store-locale-select">
              <SourceLocaleSelect
                name={`${store}-locale`}
                value={selectedValue}
                options={selectOptions}
                required={false}
                onChange={onChangeLocale}
              />
            </div>
            <Button
              type="button"
              variant="danger"
              className="store-locale-delete-btn"
              disabled={!hasLocales || !selectedValue}
              title={`${selectedValue || 'locale'} sil`}
              onClick={() => onDeleteLocale(selectedValue)}
            >
              X
            </Button>
          </div>
        </div>

        <div className="store-locale-row">
          <span className="store-locale-label">Locale Ekle</span>
          <div className="store-locale-actions">
            <div className="store-locale-select">
              <SourceLocaleSelect
                name={`${store}-locale-add`}
                value={addLocaleValue}
                options={addableLocales.length > 0 ? addableLocales : ['']}
                disabled={addableLocales.length === 0}
                required={false}
                onChange={setAddLocaleValue}
              />
            </div>
            <Button
              type="button"
              variant="primary"
              className="store-locale-add-btn"
              disabled={addableLocales.length === 0 || !addLocaleValue}
              title={addLocaleValue ? `${addLocaleValue} ekle` : 'Ekle'}
              onClick={() => {
                if (!addLocaleValue) return;
                onAddLocale(addLocaleValue);
              }}
            >
              +
            </Button>
          </div>
        </div>

        {!hasLocales ? <p>Bu store için sync edilmiş locale bulunamadı.</p> : null}

        {storeRule?.screenshotRule ? (
          <p className="store-requirement-note">
            Screenshot: {storeRule.screenshotRule.requiredForPublish ? 'publish için zorunlu' : 'opsiyonel'} | minimum {storeRule.screenshotRule.minCount}
          </p>
        ) : null}
      </div>

      <div className="store-panel-body">
        {isLoading ? (
          <p>Locale detayı yükleniyor...</p>
        ) : (
          <>
            <StoreFieldList
              store={store}
              locale={selectedValue}
              detail={detail}
              fieldRules={storeRule?.fields}
              pendingValueMap={pendingValueMap}
              onChangeField={onChangeField}
            />
            <ScreenshotField screenshots={detail?.screenshots} />
          </>
        )}
      </div>
    </article>
  );
}

type Props = {
  sourceLocale: string;
  storeRules?: Record<StoreId, StoreRuleSet>;
  localeCatalog: LocaleCatalogEntry[];
  ios: AppStorePanelState;
  play: PlayStorePanelState;
  pendingValueMap: PendingValueMap;
  onSelectIosLocale: (locale: string) => void;
  onSelectPlayLocale: (locale: string) => void;
  onDeleteIosLocale: (locale: string) => void;
  onDeletePlayLocale: (locale: string) => void;
  onAddIosLocale: (locale: string) => void;
  onAddPlayLocale: (locale: string) => void;
  onChangeStoreField: (payload: StoreFieldChangePayload) => void;
};

export default function StoreLocalePanels({
  sourceLocale,
  storeRules,
  localeCatalog,
  ios,
  play,
  pendingValueMap,
  onSelectIosLocale,
  onSelectPlayLocale,
  onDeleteIosLocale,
  onDeletePlayLocale,
  onAddIosLocale,
  onAddPlayLocale,
  onChangeStoreField,
}: Props) {
  const showIos = ios.visible !== false;
  const showPlay = play.visible !== false;

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
          localeCatalog={localeCatalog}
          pendingValueMap={pendingValueMap}
          onChangeLocale={onSelectIosLocale}
          onDeleteLocale={onDeleteIosLocale}
          onAddLocale={onAddIosLocale}
          onChangeField={onChangeStoreField}
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
          localeCatalog={localeCatalog}
          pendingValueMap={pendingValueMap}
          onChangeLocale={onSelectPlayLocale}
          onDeleteLocale={onDeletePlayLocale}
          onAddLocale={onAddPlayLocale}
          onChangeField={onChangeStoreField}
        />
      ) : null}
    </section>
  );
}
