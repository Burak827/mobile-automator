import SourceLocaleSelect from '../atoms/SourceLocaleSelect.jsx';
import TextInput from '../atoms/TextInput.jsx';

export const APP_FORM_FIELDS = [
  { key: 'canonicalName', label: 'Canonical Name', required: true },
  { key: 'ascAppId', label: 'ASC App ID' },
  { key: 'androidPackageName', label: 'Android Package Name' },
];

export default function AppConfigFields({
  value,
  localeOptions,
  onChange,
  sourceLocaleLabel = 'Source Locale',
  sourceLocaleName = 'sourceLocale',
  sourceLocaleRequired = true,
}) {
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

      {APP_FORM_FIELDS.slice(1).map((field) => (
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
