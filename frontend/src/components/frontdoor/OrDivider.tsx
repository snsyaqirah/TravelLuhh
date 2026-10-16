/** A ruled "or" between the email form and Google. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label="or">
      <span aria-hidden="true" className="h-px flex-1 bg-rule" />
      <span aria-hidden="true" className="type-overline text-ink-3">
        or
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-rule" />
    </div>
  );
}
