import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "icon";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'primary-button',
  secondary: 'secondary-button',
  ghost: 'ghost-button',
  danger: 'danger-button',
  icon: 'icon-button',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export default function Button({
  variant = 'ghost',
  className = '',
  ...props
}: Props) {
  const baseClass = VARIANT_CLASS[variant] ?? variant;
  const classes = className ? `${baseClass} ${className}` : baseClass;
  return <button className={classes} {...props} />;
}
