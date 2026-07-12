import type { InputHTMLAttributes } from "react";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function FormField({ label, error, id, className = "", ...props }: FormFieldProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        className={`min-h-12 rounded-lg border border-slate-200 bg-white px-4 text-base text-ink outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-teal-100 ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <span id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}
