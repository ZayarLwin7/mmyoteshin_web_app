"use server";

import { revalidatePath } from "next/cache";

import { assertPermission } from "@/lib/auth/guards";
import { createGenre, deleteGenre, updateGenre } from "@/lib/services/genres";
import { genreInputSchema } from "@/lib/validation/schemas";

import { toActionError } from "./errors";
import { formToObject } from "./form";
import { actionError, actionSuccess, zodFieldErrors, type ActionState } from "./types";

function parseGenreForm(formData: FormData) {
  return genreInputSchema.safeParse(formToObject(formData));
}

function revalidateGenreSurfaces() {
  revalidatePath("/admin/genres");
  revalidatePath("/genres");
  revalidatePath("/movies");
}

export async function createGenreAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await assertPermission("genre:write");

    const parsed = parseGenreForm(formData);
    if (!parsed.success) {
      return {
        ...actionError("Please correct the highlighted fields."),
        fieldErrors: zodFieldErrors(parsed.error.issues),
      };
    }

    await createGenre(parsed.data, admin);
    revalidateGenreSurfaces();

    return actionSuccess("Genre created.");
  } catch (error) {
    return toActionError(error, "genres");
  }
}

export async function updateGenreAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id")?.toString() ?? "";

  try {
    const admin = await assertPermission("genre:write");

    const parsed = parseGenreForm(formData);
    if (!parsed.success) {
      return {
        ...actionError("Please correct the highlighted fields."),
        fieldErrors: zodFieldErrors(parsed.error.issues),
      };
    }

    await updateGenre(id, parsed.data, admin);
    revalidateGenreSurfaces();

    return actionSuccess("Saved.");
  } catch (error) {
    return toActionError(error, "genres");
  }
}

export async function deleteGenreAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id")?.toString() ?? "";

  try {
    const admin = await assertPermission("genre:write");
    await deleteGenre(id, admin);
    revalidateGenreSurfaces();

    return actionSuccess("Genre deleted.");
  } catch (error) {
    return toActionError(error, "genres");
  }
}
