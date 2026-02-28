const VARIANT_CLASS = {
  primary: 'primary-button',
  secondary: 'secondary-button',
  ghost: 'ghost-button',
  danger: 'danger-button',
  icon: 'icon-button',
};

export default function Button({ variant = 'ghost', className = '', ...props }) {
  const baseClass = VARIANT_CLASS[variant] ?? variant;
  const classes = className ? `${baseClass} ${className}` : baseClass;
  return <button className={classes} {...props} />;
}
