function toLocaleValue(item) {
  if (typeof item === 'string') return item;
  return item?.locale || '';
}

export default function SourceLocaleSelect({
  name,
  value,
  options,
  onChange,
  required = false,
}) {
  return (
    <select
      name={name}
      value={value}
      required={required}
      onChange={(event) => onChange(event.target.value)}
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
