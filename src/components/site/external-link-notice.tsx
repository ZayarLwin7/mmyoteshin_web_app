import { Alert } from "@/components/ui/feedback";

/**
 * Notice shown beside external distribution links.
 *
 * The wording is deliberately precise: we state what we know (the operator
 * recorded an authorization basis and reviewed the link) and what we do not
 * claim (that the file is malware-free, or that the host is "official").
 * Overclaiming here would be both misleading and a policy risk.
 */
export function ExternalLinkNotice() {
  return (
    <Alert tone="info" className="text-xs leading-relaxed">
      <p>
        These links open a third-party website. We record the authorization basis and review every
        link before it appears here, but we do not host the files, cannot verify their contents, and
        do not guarantee they are free of malware. Download at your own discretion and respect the
        terms of the host.
      </p>
    </Alert>
  );
}

/** Short label explaining the legal basis, shown per link. */
export const AUTHORIZATION_BASIS_LABELS: Record<string, string> = {
  public_domain: "Public domain",
  open_license: "Open licence",
  distribution_agreement: "Distribution agreement",
  written_permission: "Written permission",
  publisher_authorized_page: "Publisher-authorized page",
  other_documented: "Documented authorization",
};

export function authorizationBasisLabel(basis: string | null | undefined): string | null {
  if (!basis) return null;
  return AUTHORIZATION_BASIS_LABELS[basis] ?? "Documented authorization";
}
