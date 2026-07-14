export function DiscountFormField({
  label,
  name,
  type = "text",
  required,
  form,
  setForm,
  children,
  ...inputProps
}) {
  return (
    <div className="field">
      <label>
        {label}
        {required && " *"}
      </label>
      {children || (
        <input
          type={type}
          className="input"
          required={required}
          value={form[name] ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
          {...inputProps}
        />
      )}
    </div>
  );
}
