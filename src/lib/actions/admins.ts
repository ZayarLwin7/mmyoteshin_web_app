"use server";

import { revalidatePath } from "next/cache";

import { listAdminUsers } from "@/db/queries/admin";
import { assertPermission } from "@/lib/auth/guards";
import { countActiveOwners, setAdminActive, setAdminRole } from "@/lib/services/auth";
import { ServiceError } from "@/lib/services/movies";

import { toActionError } from "./errors";
import { actionError, actionSuccess, type ActionState } from "./types";

/**
 * Administrator account management. Owner-only.
 *
 * Both actions refuse to remove the last active owner. Locking every owner out
 * of the admin area is not something the application can recover from on its
 * own, so the guard is explicit rather than implied.
 */

async function targetHoldsOwnerRole(userId: string): Promise<boolean> {
  const users = await listAdminUsers();
  const target = users.find((user) => user.id === userId);
  if (!target) throw new ServiceError("That account no longer exists.", "not_found");
  return target.role === "owner";
}

/** True when this change would leave the site with no active owner. */
async function wouldRemoveLastOwner(userId: string, stillOwner: boolean): Promise<boolean> {
  if (stillOwner) return false;
  const owners = await countActiveOwners();
  if (owners > 1) return false;
  return targetHoldsOwnerRole(userId);
}

export async function updateAdminRoleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = formData.get("userId")?.toString() ?? "";
  const role = formData.get("role")?.toString() ?? "";

  try {
    const actor = await assertPermission("admin:manage");

    if (!["owner", "admin", "editor"].includes(role)) {
      return actionError("Unknown role.");
    }

    if (await wouldRemoveLastOwner(userId, role === "owner")) {
      return actionError(
        userId === actor.id
          ? "You are the last active owner. Promote another account to owner before changing your own role."
          : "That is the last active owner. Promote another account to owner first.",
      );
    }

    await setAdminRole(userId, role as "owner" | "admin" | "editor", {
      id: actor.id,
      email: actor.email,
    });

    revalidatePath("/admin/settings");
    return actionSuccess("Role updated.");
  } catch (error) {
    return toActionError(error, "admins");
  }
}

export async function setAdminActiveAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = formData.get("userId")?.toString() ?? "";
  const isActive = formData.get("isActive")?.toString() === "true";

  try {
    const actor = await assertPermission("admin:manage");

    if (userId === actor.id && !isActive) {
      return actionError("You cannot disable your own account.");
    }

    // Disabling an owner removes them from the active-owner count.
    if (!isActive && (await wouldRemoveLastOwner(userId, false))) {
      return actionError("That is the last active owner. Promote another account to owner first.");
    }

    await setAdminActive(userId, isActive, { id: actor.id, email: actor.email });
    revalidatePath("/admin/settings");

    return actionSuccess(isActive ? "Account re-enabled." : "Account disabled.");
  } catch (error) {
    return toActionError(error, "admins");
  }
}
