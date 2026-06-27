/**
 * Standard server-action / API result shape (spec §7.9):
 *   success: { success: true, message, data }
 *   failure: { success: false, message, errors }
 *
 * Server actions return one of these so the UI can render consistent toasts +
 * field errors. `errors` maps a field name to a message (from Zod).
 */
export type ActionSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

export type ActionFailure = {
  success: false;
  message: string;
  errors?: Record<string, string>;
};

export type ActionResult<T = undefined> = ActionSuccess<T> | ActionFailure;

export function ok<T>(data: T, message = "Done."): ActionSuccess<T> {
  return { success: true, message, data };
}

export function fail(
  message: string,
  errors?: Record<string, string>,
): ActionFailure {
  return { success: false, message, errors };
}

/**
 * Flatten a ZodError's issues into a field->message map. Accepts Zod's issue
 * shape where `path` entries are PropertyKeys (string | number | symbol); we
 * stringify each segment so symbol keys don't break the join.
 */
export function zodErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map((p) => String(p)).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
