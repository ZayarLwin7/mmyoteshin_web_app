/**
 * Helpers for turning `FormData` into a plain object for Zod.
 *
 * Lives outside the `"use server"` action modules because those files may only
 * export async functions.
 */

/**
 * Read the given keys from a form submission.
 *
 * `checkbox` and `multiple` fields need special handling: an unchecked box is
 * absent entirely, and a multi-select arrives as repeated keys.
 */
export function formToObject(
  formData: FormData,
  options: { multi?: string[]; checkboxes?: string[] } = {},
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const multi = new Set(options.multi ?? []);
  const checkboxes = new Set(options.checkboxes ?? []);

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (multi.has(key)) continue;
    if (checkboxes.has(key)) continue;
    // Only take the first value for ordinary fields.
    if (!(key in result)) result[key] = typeof value === "string" ? value : value.name;
  }

  for (const key of multi) {
    result[key] = formData
      .getAll(key)
      .map(String)
      .filter((entry) => entry !== "");
  }

  for (const key of checkboxes) {
    result[key] = formData.get(key) !== null;
  }

  return result;
}

/** Read a UUID that may be present in the path or the body. */
export function readId(formData: FormData, key = "id"): string {
  return formData.get(key)?.toString() ?? "";
}
