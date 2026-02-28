import type { LocaleCatalogEntry } from "../../types";
import type { ChangeEvent } from "react";

type LocaleOption = string | Pick<LocaleCatalogEntry, "locale">;

function toLocaleValue(item: LocaleOption): string {
  if (typeof item === 'string') return item;
  return item?.locale || '';
}

type Props = {
  name: string;
  value: string;
  options: LocaleOption[];
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
};

export default function SourceLocaleSelect({
  name,
  value,
  options,
  onChange,
  required = false,
  disabled = false,
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
      {options.map((item) => {
        const locale = toLocaleValue(item);
        return (
          <option key={locale} value={locale}>
            {locale}
          </option>
        );
      })}
    </select>
  );
}
