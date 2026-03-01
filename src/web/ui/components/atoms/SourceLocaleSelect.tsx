import type { LocaleCatalogEntry } from "../../types";
import type { ChangeEvent } from "react";

type LocaleOption =
  | string
  | Pick<LocaleCatalogEntry, "locale">
  | {
      locale: string;
      label?: string;
    };

function toLocaleValue(item: LocaleOption): string {
  if (typeof item === 'string') return item;
  return item?.locale || '';
}

function toLocaleLabel(item: LocaleOption): string {
  if (typeof item === 'string') return item;
  const maybeLabel = 'label' in item ? item.label : undefined;
  return typeof maybeLabel === 'string' && maybeLabel.trim().length > 0
    ? maybeLabel
    : item.locale;
}

type Props = {
  name: string;
  value: string;
  options: LocaleOption[];
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export default function SourceLocaleSelect({
  name,
  value,
  options,
  onChange,
  required = false,
  disabled = false,
  placeholder,
}: Props) {
  return (
    <select
      name={name}
      value={value}
      disabled={disabled}
      required={required}
      onChange={(event: ChangeEvent<HTMLSelectElement>) =>
        onChange(event.target.value)
      }
    >
      {placeholder ? (
        <option value="">
          {placeholder}
        </option>
      ) : null}
      {options.map((item) => {
        const locale = toLocaleValue(item);
        const label = toLocaleLabel(item);
        return (
          <option key={locale} value={locale}>
            {label}
          </option>
        );
      })}
    </select>
  );
}
