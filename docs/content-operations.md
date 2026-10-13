# Content operations

How to add a film, how to decide whether a distribution link may be published, how to attribute
correctly, and what to do when someone asks us to take something down.

This is the operational counterpart to the publication gate in code. The code enforces the rules;
this document explains what the rules mean in practice.

---

## 1. The one rule

**Publish a distribution link only when we hold a documented right to do so.**

If authorization is unknown, the link stays in `pending_review`. It is not visible to anyone outside
the admin area. There is no "probably fine" state.

The product does not host, mirror, proxy or scrape anything. It links out. If a link would require us
to store or serve the file, we do not publish it.

---

## 2. Adding a film

Work through the film page in this order. The readiness panel tells you exactly what is still
blocking publication.

### 2.1 Metadata — `/admin/movies/new`

| Field | Guidance |
| --- | --- |
| Title | As the film is generally known. Required. |
| Original title | The title in its original language, if different. |
| URL slug | Generated from the title. Change it only before publishing — changing a slug after publication breaks existing links. |
| Release year | Required for publication. |
| Runtime | Minutes. |
| Language / country | ISO 639-1 code, and country of origin. |
| Content rating | **As certified.** Do not invent one. |
| Genres | At least one is required for publication. |
| Synopsis | Required. **Write it yourself.** See §4. |
| Artwork | Poster and backdrop URLs. The host must be in `NEXT_PUBLIC_IMAGE_HOSTS` or the image will not load. |
| Artwork credit | Who supplied the image, if it is not ours. Shown publicly. |
| Curation weight | Higher sorts earlier in Editor's picks. `0` excludes it from that rail. |
| Featured | Eligible for the home hero. Use sparingly — three to five films. |

New films are always saved as **draft**. Publishing is a separate, permissioned step.

### 2.2 Editorial review

Open **Write a new review** on the film page.

- The body must be at least 50 characters to save, and **at least 200 characters to publish**. The
  200-character floor is the publication gate: a two-line stub is not an editorial review.
- Set **Status** to `published`. A film cannot be published without a published review.
- **Rating** is optional. If you give one, it is shown as `n / 10` with its scale everywhere, and the
  film page explains the methodology. Never present it as a user score or an aggregate — the app
  labels it as an editorial score and the `Rating source` field records what kind of score it is.
- **Reviewer name** is shown publicly. A review is attributable or it does not run.

Only one review per film can be `published` at a time. The database enforces this with a partial
unique index.

### 2.3 Publish

The readiness panel must read **"Ready to publish"**. If it is blocked, the panel lists every reason.
Click **Publish**, then confirm.

Publishing makes the film publicly visible, adds it to the catalogue and the sitemap, and writes an
audit entry. Archiving reverses all of that.

**A film may be published with no download link at all.** The editorial catalogue is the point; a
missing link is not a defect. The film page says so plainly rather than showing an empty section.

---

## 3. Authorizing a distribution link

This is the highest-risk action in the product. Take it slowly.

### 3.1 Add the link

On the film page, open **Add a link**.

| Field | Guidance |
| --- | --- |
| Provider name | Who actually distributes it, e.g. "Internet Archive". Shown publicly. |
| Label | What the visitor sees, e.g. "Authorized download — 1080p". Be plain. Never write "Download now" in a way that implies we host it. |
| Destination URL | `https` only. Loopback, private and internal hosts are rejected. |
| Quality / size / language | Fill in **only what you verified**. |
| Authorization basis | See §3.2. |
| Private authorization reference | See §3.3. |
| Authorization notes | Internal reasoning, for the next reviewer. |

The link is created as `pending_review` and is not visible to anyone outside the admin area.

### 3.2 Choosing the authorization basis

| Basis | Use when |
| --- | --- |
| `public_domain` | The work is in the public domain **in the relevant territory**. Verify per territory — "public domain in the US" is not "public domain everywhere". |
| `open_license` | Released under a licence that permits redistribution, **and** the licence's attribution and share-alike terms are satisfied. |
| `distribution_agreement` | We hold an agreement with the distributor. |
| `written_permission` | The rights holder gave written permission. |
| `publisher_authorized_page` | We are linking to the rights holder's own authorized distribution page. |
| `other_documented` | Anything else — explain it in the notes. |

"The file is freely downloadable" is **not** an authorization basis. Nor is "it is on a big site",
"someone on a forum said it was fine", or "we could not find the rights holder".

### 3.3 Recording the private reference

Required before a link can be activated. It is the evidence: a contract id, the subject line and date
of a permission email, or a licence URL.

It is stored for our records and **is never returned to a public client** — the public read layer
selects an explicit column list that omits it. You will see it on the admin film page so you can
verify it; a visitor never will.

### 3.4 Activate

Click **Activate (make public)** and confirm. Activation requires the `link:authorize` permission —
editors cannot do it.

Activation records who authorized the link and when. Both are part of the public visibility
condition: an active link without an authorization basis or an authorized-at timestamp is hidden by
the database, not merely by the UI.

### 3.5 Maintenance

- **Check links periodically.** The admin link list surfaces any link not checked within 180 days.
  Open the destination, confirm it still resolves to the authorized distribution, then **Mark as
  checked today**.
- **Changing the destination of an active link returns it to `pending_review`.** That is deliberate —
  a new destination is a new authorization decision.
- **Disable immediately** if a link breaks, redirects somewhere unexpected, or is questioned. Editors
  can disable; that is a safety action and should never be blocked.
- **Delete** removes the record permanently, including its authorization notes. Only possible while
  the link is not active. Prefer disabling, so the history survives.

---

## 4. Attribution and originality

**Synopses and reviews must be our own writing.** Do not copy, and do not lightly paraphrase, another
publication. Do not use an automatically generated draft as the published text. The review form says
this; it is a real requirement, not boilerplate.

**Artwork.** Use only images we have permission to display. Record who supplied them in *Artwork
credit*, which is shown publicly. The host must be in `NEXT_PUBLIC_IMAGE_HOSTS`.

**Ratings.** Ours are editorial scores on a documented 10-point scale. Never present one as a user
score, an aggregate, or a score from another service. If you are citing someone else's score, that is
a different `Rating source` and the scale must still be shown.

**Metadata.** Release year, runtime, certification and country should come from a source you can
name. Do not fill in a plausible value.

---

## 5. Reports and takedowns

### 5.1 Incoming reports

Reports arrive at `/admin/reports`. Each one is either about a film or about a specific link.

- **Editor:** can read, annotate and set *Under review*. Cannot close.
- **Admin / owner:** can resolve or reject, and can disable the reported link in the same action.

Reported links are moved to `reported` automatically, which removes them from public view
immediately — before anyone looks at them.

### 5.2 Takedown notices

Notices arrive at `NEXT_PUBLIC_TAKEDOWN_EMAIL`, published on `/copyright`.

**Response targets:** acknowledge within 2 business days; contain within 1 business day of
establishing that the complaint is valid.

**Process:**

1. **Contain first.** Disable the link. Do not wait to finish the analysis — the site should not be
   serving a disputed link while it is being discussed.
2. Log it as a report if one does not already exist, so the decision is recorded in the audit trail.
3. Verify the claim against the recorded authorization basis and reference.
4. **If the complaint is valid:** keep the link disabled permanently, reply to the complainant, and
   check whether the same provider or basis was used elsewhere. `/admin/links` lists every link with
   its basis and last-checked date.
5. **If the complaint is not valid:** reply explaining the basis, and reject the report with a note.
   Do not simply re-enable without a reply — the exchange is part of the record.
6. If several links share an implicated basis, treat it as a content-policy failure and review every
   film using it.

**Never** argue about whether the complainant "should" have complained. Contain, verify, respond.

### 5.3 Routine broken-link reports

If the destination is dead or has moved somewhere unauthorized: disable the link, check whether an
authorized alternative exists, and update the film page if one does. If the film has no other link it
simply shows no download options — which is a legitimate state, not an error.

---

## 6. Advertising

Ads are **off by default** and must stay off until the network account and site are approved.

When enabling them:

- Keep every slot clearly labelled as advertising.
- Never let an ad resemble a download control. No fake buttons, countdowns or progress bars.
- Reserve the space so enabling ads does not cause layout shift.
- The site must remain fully usable with ads disabled or blocked.
- Disclose advertising on `/advertising` before the first ad goes live.

If a network's creative violates these rules, remove the network — not the rule.

---

## 7. Analytics

Analytics is off by default, consent-gated, and cookieless. No identifier is stored for an outbound
click.

If you change what is collected, update `/privacy` in the same change. A privacy page that does not
match the implementation is worse than no page.

---

## 8. Editorial hygiene

- Use `/admin/audit` to review privileged changes. Publishing, archiving and every link status change
  are recorded.
- Give every administrator the **lowest** role that lets them work. Editors can draft and disable;
  they cannot publish or authorize.
- Deactivate an account in `/admin/settings` the day someone leaves. The role is re-read from the
  database on every request, so deactivation takes effect immediately.
