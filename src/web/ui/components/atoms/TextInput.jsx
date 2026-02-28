export default function TextInput({ value, onChange, ...props }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...props}
    />
  );
}
