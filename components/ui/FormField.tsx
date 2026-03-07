"use client"

import {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  useId,
} from "react"

type FormFieldRenderProps = {
  id: string
  "aria-invalid": true | undefined
  "aria-describedby": string | undefined
}

export function FormField({
  label,
  hint,
  error,
  required,
  hideLabel,
  id,
  className = "",
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  hideLabel?: boolean
  id?: string
  className?: string
  children: (props: FormFieldRenderProps) => ReactNode
}) {
  const autoId = useId().replace(/:/g, "")
  const fieldId = id ?? `field-${autoId}`
  const hintId = hint ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const describedBy =
    [hintId, errorId].filter(Boolean).join(" ") || undefined

  return (
    <div className={`space-y-1 ${className}`}>
      <label
        htmlFor={fieldId}
        className={hideLabel ? "sr-only" : "text-xs text-muted"}
      >
        {label}
        {required ? (
          <span className="ml-1 text-[var(--danger-fg)]">*</span>
        ) : null}
      </label>
      {children({
        id: fieldId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {hint ? (
        <div
          id={hintId}
          className="text-xs text-secondary"
        >
          {hint}
        </div>
      ) : null}
      {error ? (
        <div
          id={errorId}
          role="alert"
          className="text-xs text-[var(--danger-fg)]"
        >
          {error}
        </div>
      ) : null}
    </div>
  )
}

type FormInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id"
> & {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  id?: string
  className?: string
}

export function FormInput({
  label,
  hint,
  error,
  id,
  className = "",
  required,
  ...inputProps
}: FormInputProps) {
  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      required={required}
      id={id}
      className={className}
    >
      {fieldProps => (
        <input
          {...inputProps}
          {...fieldProps}
          required={required}
          className="input-premium w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      )}
    </FormField>
  )
}

type FormSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id"
> & {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  id?: string
  className?: string
}

export function FormSelect({
  label,
  hint,
  error,
  id,
  className = "",
  required,
  children,
  ...selectProps
}: FormSelectProps) {
  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      required={required}
      id={id}
      className={className}
    >
      {fieldProps => (
        <select
          {...selectProps}
          {...fieldProps}
          required={required}
          className="input-premium w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          {children}
        </select>
      )}
    </FormField>
  )
}

type FormCheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "type"
> & {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  id?: string
  className?: string
}

export function FormCheckbox({
  label,
  hint,
  error,
  id,
  className = "",
  required,
  ...checkboxProps
}: FormCheckboxProps) {
  return (
    <FormField
      label={label}
      hideLabel
      hint={hint}
      error={error}
      required={required}
      id={id}
      className={className}
    >
      {fieldProps => (
        <label
          htmlFor={fieldProps.id}
          className="flex items-start gap-2 text-sm"
        >
          <input
            {...checkboxProps}
            {...fieldProps}
            required={required}
            type="checkbox"
            className="mt-0.5 h-4 w-4"
          />
          <span>{label}</span>
        </label>
      )}
    </FormField>
  )
}
