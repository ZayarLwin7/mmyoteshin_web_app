"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertPermission } from "@/lib/auth/guards";
import {
  archiveMovie,
  createMovie,
  publishMovie,
  restoreMovieToDraft,
  updateMovie,
} from "@/lib/services/movies";
import { movieInputSchema } from "@/lib/validation/schemas";

import { toActionError } from "./errors";
import { formToObject } from "./form";
import { actionError, actionSuccess, zodFieldErrors, type ActionState } from "./types";

/**
 * Movie write actions.
 *
 * Every action re-checks the caller's permission on the server — hiding a
 * button in the UI is never the control. Errors are translated into a safe
 * message; the underlying cause is logged, never returned.
 */

function parseMovieForm(formData: FormData) {
  return movieInputSchema.safeParse(
    formToObject(formData, { multi: ["genreIds"], checkboxes: ["featured"] }),
  );
}

export async function createMovieAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let newId: string;

  try {
    const admin = await assertPermission("movie:write");

    const parsed = parseMovieForm(formData);
    if (!parsed.success) {
      return {
        ...actionError("Please correct the highlighted fields."),
        fieldErrors: zodFieldErrors(parsed.error.issues),
      };
    }

    const movie = await createMovie(parsed.data, admin);
    newId = movie.id;

    revalidatePath("/admin/movies");
    revalidatePath("/admin");
  } catch (error) {
    return toActionError(error, "movies");
  }

  // Outside the try so the redirect exception is not swallowed.
  redirect(`/admin/movies/${newId}`);
}

export async function updateMovieAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id")?.toString() ?? "";

  try {
    const admin = await assertPermission("movie:write");

    const parsed = parseMovieForm(formData);
    if (!parsed.success) {
      return {
        ...actionError("Please correct the highlighted fields."),
        fieldErrors: zodFieldErrors(parsed.error.issues),
      };
    }

    const movie = await updateMovie(id, parsed.data, admin);

    revalidatePath("/admin/movies");
    revalidatePath(`/admin/movies/${id}`);
    revalidatePath(`/movies/${movie.slug}`);
    revalidatePath("/movies");
    revalidatePath("/");

    return actionSuccess("Saved.");
  } catch (error) {
    return toActionError(error, "movies");
  }
}

export async function publishMovieAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id")?.toString() ?? "";

  try {
    const admin = await assertPermission("movie:publish");
    const movie = await publishMovie(id, admin);

    revalidatePath("/admin/movies");
    revalidatePath(`/admin/movies/${id}`);
    revalidatePath(`/movies/${movie.slug}`);
    revalidatePath("/movies");
    revalidatePath("/");
    revalidatePath("/sitemap.xml");

    return actionSuccess("Published.");
  } catch (error) {
    return toActionError(error, "movies");
  }
}

export async function archiveMovieAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id")?.toString() ?? "";

  try {
    const admin = await assertPermission("movie:archive");
    const movie = await archiveMovie(id, admin);

    revalidatePath("/admin/movies");
    revalidatePath(`/admin/movies/${id}`);
    revalidatePath(`/movies/${movie.slug}`);
    revalidatePath("/movies");
    revalidatePath("/");
    revalidatePath("/sitemap.xml");

    return actionSuccess("Archived. The film is no longer publicly visible.");
  } catch (error) {
    return toActionError(error, "movies");
  }
}

export async function restoreMovieAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id")?.toString() ?? "";

  try {
    const admin = await assertPermission("movie:write");
    await restoreMovieToDraft(id, admin);

    revalidatePath("/admin/movies");
    revalidatePath(`/admin/movies/${id}`);

    return actionSuccess("Moved back to draft.");
  } catch (error) {
    return toActionError(error, "movies");
  }
}
