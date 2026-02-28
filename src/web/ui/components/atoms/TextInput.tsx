import type { ChangeEvent, InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export default function TextInput({ value, onChange, ...props }: Props) {
  return (
    <input
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) =>
        onChange(event.target.value)
      }
      {...props}
    />
  );
}
