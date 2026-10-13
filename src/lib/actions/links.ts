"use server";

import { revalidatePath } from "next/cache";

import { assertPermission } from "@/lib/auth/guards";
import {
  activateLink,
  createLink,
  deleteLink,
  disableLink,
  markLinkChecked,
  updateLink,
} from "@/lib/services/links";
import { downloadLinkInputSchema } from "@/lib/validation/schemas";

import { toActionError } from "./errors";
import { formToObject } from "./form";
import { actionError, actionSuccess, zodFieldErrors, type ActionState } from "./types";

function parseLinkForm(formData: FormData) {
  return downloadLinkInputSchema.safeParse(formToObject(formData));
}

function revalidateLinkSurfaces(movieId?: string) {
  revalidatePath("/admin/links");
  revalidatePath("/admin");
  if (movieId) revalidatePath(`/admin/movies/${movieId}`);
}

export async function createLinkAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await assertPermission("link:write");

    const parsed = parseLinkForm(formData);
    if (!parsed.success) {
      return {
        ...actionError("Please correct the highlighted fields."),
        fieldErrors: zodFieldErrors(parsed.error.issues),
      };
    }

    await createLink(parsed.data, admin);
    revalidateLinkSurfaces(parsed.data.movieId);

    return actionSuccess(
      "Link saved in review. It will not appear publicly until it is activated.",
    );
  } catch (error) {
    return toActionError(error, "links");
  }
}

export async function updateLinkAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id")?.toString() ?? "";

  try {
    const admin = await assertPermission("link:write");

    const parsed = parseLinkForm(formData);
    if (!parsed.success) {
      return {
        ...actionError("Please correct the highlighted fields."),
        fieldErrors: zodFieldErrors(parsed.error.issues),
      };
    }

    await updateLink(id, parsed.data, admin);
    revalidateLinkSurfaces(parsed.data.movieId);

    return actionSuccess("Saved.");
  } catch (error) {
    return toActionError(error, "links");
  }
}

/**
 * Activate a link.
 *
 * Requires the separate `link:authorize` permission, which editors do not
 * hold — recording a legal basis is an admin decision.
 */
export async function activateLinkAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id")?.toString() ?? "";
  const movieId = formData.get("movieId")?.toString();

  try {
    const admin = await assertPermission("link:authorize");
    await activateLink(id, admin);

    revalidateLinkSurfaces(movieId);
    if (movieId) revalidatePath(`/admin/movies/${movieId}`);

    return actionSuccess("Link activated. It is now visible on the film page.");
  } catch (error) {
    return toActionError(error, "links");
  }
}

/** Disabling is available to editors so a credible report can be acted on fast. */
export async function disableLinkAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id")?.toString() ?? "";
  const movieId = formData.get("movieId")?.toString();
  const reason = formData.get("reason")?.toString();

  try {
    const admin = await assertPermission("link:disable");
    await disableLink(id, admin, reason);

    revalidateLinkSurfaces(movieId);

    return actionSuccess("Link disabled. It is no longer publicly visible.");
  } catch (error) {
    return toActionError(error, "links");
  }
}

export async function markLinkCheckedAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id")?.toString() ?? "";
  const movieId = formData.get("movieId")?.toString();

  try {
    const admin = await assertPermission("link:write");
    await markLinkChecked(id, admin);
    revalidateLinkSurfaces(movieId);

    return actionSuccess("Recorded today's check.");
  } catch (error) {
    return toActionError(error, "links");
  }
}

export async function deleteLinkAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id")?.toString() ?? "";
  const movieId = formData.get("movieId")?.toString();

  try {
    const admin = await assertPermission("link:write");
    await deleteLink(id, admin);
    revalidateLinkSurfaces(movieId);

    return actionSuccess("Link deleted.");
  } catch (error) {
    return toActionError(error, "links");
  }
}
