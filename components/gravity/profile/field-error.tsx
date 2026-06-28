/**
 * Inline field error — consistent crimson validation message under inputs.
 * Renders nothing when there's no message (keeps layout stable).
 */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs font-medium text-crimson-400">
      {message}
    </p>
  );
}
