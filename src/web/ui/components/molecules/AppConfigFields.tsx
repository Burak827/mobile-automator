import SourceLocaleSelect from '../atoms/SourceLocaleSelect';
import TextInput from '../atoms/TextInput';
import type { AppConfigField, AppConfigForm, LocaleCatalogEntry } from '../../types';

type SecondaryField = Exclude<AppConfigField, "canonicalName" | "sourceLocale">;

export const APP_FORM_FIELDS: Array<{
  key: SecondaryField;
  label: string;
  required?: boolean;
}> = [
  { key: 'ascAppId', label: 'ASC App ID' },
  { key: 'androidPackageName', label: 'Android Package Name' },
] as const;

const SECONDARY_FIELDS = APP_FORM_FIELDS;

type Props = {
  value: AppConfigForm;
  localeOptions: LocaleCatalogEntry[];
  onChange: (field: AppConfigField, value: string) => void;
  sourceLocaleLabel?: string;
  sourceLocaleName?: string;
  sourceLocaleRequired?: boolean;
};

export default function AppConfigFields({
  value,
  localeOptions,
  onChange,
  sourceLocaleLabel = 'Source Locale',
  sourceLocaleName = 'sourceLocale',
  sourceLocaleRequired = true,
}: Props) {
  return (
    <>
      <label>
        Canonical Name
        <TextInput
          required
          name="canonicalName"
          value={value.canonicalName}
          onChange={(nextValue) => onChange('canonicalName', nextValue)}
        />
      </label>

      <label>
        {sourceLocaleLabel}
        <SourceLocaleSelect
          name={sourceLocaleName}
          value={value.sourceLocale}
          options={localeOptions}
          required={sourceLocaleRequired}
          onChange={(nextValue) => onChange('sourceLocale', nextValue)}
        />
      </label>

      {SECONDARY_FIELDS.map((field) => (
        <label key={field.key}>
          {field.label}
          <TextInput
            required={Boolean(field.required)}
            name={field.key}
            value={value[field.key]}
            onChange={(nextValue) => onChange(field.key, nextValue)}
          />
        </label>
      ))}
    </>
  );
}
