/**
 * Create an administrator.
 *
 *   pnpm admin:create
 *   pnpm admin:create -- --email you@example.com --name "Your Name" --role owner
 *
 * This is the documented first-admin provisioning procedure (see
 * docs/security.md). It is the ONLY supported way to create an account — there
 * is no public sign-up route and no default credentials.
 *
 * The password is read from a hidden prompt, or from BOOTSTRAP_ADMIN_PASSWORD
 * for automated provisioning. It is never accepted as a command-line argument
 * because arguments leak into shell history and process listings.
 */

import { createInterface } from "node:readline";
import { Writable } from "node:stream";

import { config as loadEnv } from "dotenv";
import postgres from "postgres";

import { hashPassword } from "../src/lib/auth/password";
import { adminUserCreateSchema } from "../src/lib/validation/schemas";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env", override: false });

type Flags = {
  email?: string;
  name?: string;
  role?: string;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--email") flags.email = argv[++index];
    else if (token === "--name") flags.name = argv[++index];
    else if (token === "--role") flags.role = argv[++index];
  }
  return flags;
}

/** Prompt without echoing the typed characters. */
async function promptHidden(question: string): Promise<string> {
  const muted = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  process.stdout.write(question);

  return new Promise((resolve) => {
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function promptVisible(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  const email =
    flags.email ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? (await promptVisible("Email: "));
  // Every other field has a non-interactive source; without this the script
  // blocks on a prompt in CI, which has no stdin to answer it.
  const displayName =
    flags.name ?? process.env.BOOTSTRAP_ADMIN_NAME ?? (await promptVisible("Display name: "));

  const role = (flags.role ?? "owner").toLowerCase();
  if (!["owner", "admin", "editor"].includes(role)) {
    console.error(`\n  Unknown role "${role}". Use owner, admin or editor.\n`);
    process.exit(1);
  }

  const password =
    process.env.BOOTSTRAP_ADMIN_PASSWORD ?? (await promptHidden("Password (hidden): "));

  const parsed = adminUserCreateSchema.safeParse({ email, displayName, password, role });
  if (!parsed.success) {
    console.error("\n  The details did not pass validation:");
    for (const issue of parsed.error.issues) {
      console.error(`   - ${issue.path.join(".") || "value"}: ${issue.message}`);
    }
    console.error("");
    process.exit(1);
  }

  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("\n  Missing DATABASE_URL. See .env.example.\n");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", onnotice: () => {} });

  try {
    const existing = await sql<{ id: string }[]>`
      select id from admin_users where email = ${parsed.data.email}
    `;

    if (existing.length > 0) {
      console.error(`\n  An account for ${parsed.data.email} already exists.\n`);
      process.exit(1);
    }

    const passwordHash = await hashPassword(parsed.data.password);

    await sql.begin(async (tx) => {
      const inserted = await tx<{ id: string }[]>`
        insert into admin_users (email, password_hash, display_name)
        values (${parsed.data.email}, ${passwordHash}, ${parsed.data.displayName})
        returning id
      `;

      const userId = inserted[0]?.id;
      if (!userId) throw new Error("Insert did not return an id.");

      await tx`
        insert into admin_profiles (user_id, role)
        values (${userId}, ${parsed.data.role})
      `;

      await tx`
        insert into audit_logs (actor_id, actor_email, action, entity_type, entity_id, summary)
        values (
          ${userId},
          ${parsed.data.email},
          'admin.created',
          'admin_user',
          ${userId},
          ${`Bootstrapped the first ${parsed.data.role} account.`}
        )
      `;
    });

    console.log(`\n  Created ${parsed.data.role} account: ${parsed.data.email}`);
    console.log("  Sign in at /admin/login\n");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("\nFailed to create the administrator.");
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/:\/\/[^@]*@/g, "://***:***@"));
  process.exit(1);
});
