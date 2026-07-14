export function FormField({
  name,
  label,
  type = "text",
  placeholder,
  autoComplete,
  value,
  onChange,
  error,
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        type={type}
        className={`input${error ? " input--error" : ""}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
