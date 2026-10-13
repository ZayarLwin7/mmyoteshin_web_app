"use server";

import { revalidatePath } from "next/cache";

import { assertPermission } from "@/lib/auth/guards";
import { createReview, setReviewStatus, updateReview } from "@/lib/services/reviews";
import { reviewInputSchema, reviewStatusSchema } from "@/lib/validation/schemas";

import { toActionError } from "./errors";
import { formToObject } from "./form";
import { actionError, actionSuccess, zodFieldErrors, type ActionState } from "./types";

function parseReviewForm(formData: FormData) {
  return reviewInputSchema.safeParse(formToObject(formData));
}

function revalidateReviewSurfaces(movieId: string) {
  revalidatePath("/admin/reviews");
  revalidatePath(`/admin/movies/${movieId}`);
}

export async function createReviewAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await assertPermission("review:write");

    const parsed = parseReviewForm(formData);
    if (!parsed.success) {
      return {
        ...actionError("Please correct the highlighted fields."),
        fieldErrors: zodFieldErrors(parsed.error.issues),
      };
    }

    // Publishing is a higher-privilege action than writing a draft.
    if (parsed.data.status === "published") {
      await assertPermission("review:publish");
    }

    await createReview(parsed.data, admin);
    revalidateReviewSurfaces(parsed.data.movieId);

    return actionSuccess(parsed.data.status === "published" ? "Review published." : "Draft saved.");
  } catch (error) {
    return toActionError(error, "reviews");
  }
}

export async function updateReviewAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id")?.toString() ?? "";

  try {
    const admin = await assertPermission("review:write");

    const parsed = parseReviewForm(formData);
    if (!parsed.success) {
      return {
        ...actionError("Please correct the highlighted fields."),
        fieldErrors: zodFieldErrors(parsed.error.issues),
      };
    }

    if (parsed.data.status === "published") {
      await assertPermission("review:publish");
    }

    await updateReview(id, parsed.data, admin);
    revalidateReviewSurfaces(parsed.data.movieId);

    return actionSuccess("Saved.");
  } catch (error) {
    return toActionError(error, "reviews");
  }
}

export async function setReviewStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id")?.toString() ?? "";
  const movieId = formData.get("movieId")?.toString() ?? "";

  try {
    const status = reviewStatusSchema.safeParse(formData.get("status")?.toString());
    if (!status.success) {
      return actionError("Unknown review status.");
    }

    // Publishing or archiving needs the publish permission; drafting does not.
    const admin =
      status.data === "published"
        ? await assertPermission("review:publish")
        : await assertPermission("review:write");

    await setReviewStatus(id, status.data, admin);
    revalidateReviewSurfaces(movieId);

    return actionSuccess(`Review set to ${status.data}.`);
  } catch (error) {
    return toActionError(error, "reviews");
  }
}
