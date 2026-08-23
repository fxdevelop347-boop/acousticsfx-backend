# Newsletter sending and deliverability

The code sends the newsletter. It cannot make inboxes trust you. This document
covers both halves: what the app already does, and the DNS work you must do
before the first real campaign goes out.

Skip the DNS section and your mail will land in spam regardless of the code.

---

## 1. What the app does

**Sending** — `POST /api/admin/newsletter/send` (permission `content:write`).
Composed in Admin → Newsletter → *Send newsletter*.

- One message per recipient. Never BCC — a large BCC list is one of the
  strongest spam signals there is.
- `text/html` and `text/plain` on every message. HTML-only mail scores badly.
- Batches of 100 with a 500 ms pause, so a send never arrives as one burst.
- Body HTML is sanitized server-side (`sanitizeNewsletterHtml`): scripts and
  data-URI images are stripped, and the email shell inlines every style because
  Gmail discards `<style>` blocks.
- Every message carries `List-Unsubscribe`, `List-Unsubscribe-Post:
  List-Unsubscribe=One-Click`, and `List-Id`. The one-click pair is what turns
  Gmail's and Yahoo's unsubscribe button into a silent request instead of a
  spam complaint.
- Each recipient gets a personal HMAC-signed unsubscribe link. Clicking it, or
  the provider's own button, sets `status: 'unsubscribed'` and that address is
  excluded from every later send.
- Every campaign is recorded in the `newsletter_campaigns` collection.

**Limits** — sending is synchronous. Comfortable to about 1,000 recipients;
refused above 5,000 (`MAX_RECIPIENTS`), because the request would outlive a
typical proxy timeout. Growing past that means moving to a job queue.

**Transport** — `RESEND_API_KEY` if set, otherwise the existing `SMTP_*`
transport, otherwise the send is logged to the console and reported as sent
(the same convention the password-reset mail already uses in dev).

---

## 2. DNS: the part that actually keeps you out of spam

### 2.1 Send from a subdomain

Set `NEWSLETTER_FROM` to an address on **`send.acousticsfx.com`**, not on
`acousticsfx.com` itself.

Bulk mail attracts complaints even when it is done well. Isolating it on a
subdomain means a bad campaign damages the reputation of `send.` only — your
password resets, invoices, and ordinary business mail from the root domain keep
delivering. This is the single highest-leverage choice on this page, and it is
irreversible in practice once you have built reputation, so make it now.

### 2.2 Verify the domain in Resend

Resend → **Domains** → *Add Domain* → `send.acousticsfx.com`. It then shows the
exact records to create. Copy them from the dashboard rather than from here —
the DKIM key is unique to you and the SES region varies by account. They take
this shape:

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| `MX` | `send.acousticsfx.com` | `feedback-smtp.<region>.amazonses.com` (priority 10) | Bounce and complaint feedback |
| `TXT` | `send.acousticsfx.com` | `v=spf1 include:amazonses.com ~all` | SPF |
| `TXT` | `resend._domainkey.acousticsfx.com` | `p=MIGfMA0GCSq...` | DKIM |

Wait for all three to read **Verified** in the dashboard. Do not send before
that; unauthenticated mail from a cold domain goes straight to spam.

> If `acousticsfx.com` already has an SPF record, do **not** add a second one —
> two SPF records is a hard failure. Merge the `include:` into the existing
> record instead. SPF also permits at most 10 DNS lookups in total.

### 2.3 DMARC

Add one `TXT` record on the root domain. Start permissive:

```
Name:  _dmarc.acousticsfx.com
Value: v=DMARC1; p=none; rua=mailto:dmarc@acousticsfx.com; adkim=r; aspf=r; pct=100
```

`p=none` monitors without affecting delivery. Read the aggregate reports that
arrive at `rua` for two to four weeks; once everything legitimate is passing,
tighten to `p=quarantine`, and later `p=reject`.

Do not start at `p=reject`. If any of your legitimate mail streams — a CRM, an
invoicing tool, a form handler — is not yet aligned, you will silently destroy
your own mail.

### 2.4 Gmail and Yahoo bulk-sender rules

Anyone sending over ~5,000 messages a day to Gmail must have SPF, DKIM, DMARC,
one-click unsubscribe, and a spam-complaint rate under 0.30% (aim for under
0.10%). The app already provides one-click unsubscribe; the rest is the DNS
above plus list hygiene. These rules are worth meeting even below the
threshold — they describe what the filters reward at any volume.

---

## 3. Environment variables

Set these in the backend `.env` (all are documented in `.env.example`):

```sh
RESEND_API_KEY=re_xxxxxxxx
NEWSLETTER_FROM="AcousticsFX <newsletter@send.acousticsfx.com>"
NEWSLETTER_REPLY_TO=info@acousticsfx.com          # must be a monitored mailbox
NEWSLETTER_UNSUBSCRIBE_MAILBOX=unsubscribe@acousticsfx.com
NEWSLETTER_POSTAL_ADDRESS="AcousticsFX, <street>, <city>, <country>"
PUBLIC_SITE_URL=https://acousticsfx.com
PUBLIC_API_URL=https://api.acousticsfx.com
```

Two of these are easy to get wrong and both break silently:

- **`PUBLIC_API_URL`** must be reachable from a recipient's inbox. Left at
  `localhost`, every unsubscribe link in delivered mail is dead — and a dead
  unsubscribe link earns spam complaints instead of quiet opt-outs.
- **`NEWSLETTER_POSTAL_ADDRESS`** is required by CAN-SPAM and its absence is a
  scored spam signal. Blank omits the footer line entirely.

`UNSUBSCRIBE_SECRET` defaults to `JWT_SECRET`. Set it explicitly if you like,
but never change it afterwards — doing so invalidates the unsubscribe links in
every email already delivered.

---

## 4. Before the first real campaign

1. **Warm up.** A domain that has never sent mail suddenly emitting thousands of
   messages looks exactly like a compromised account. Roughly: day 1 send ~50,
   then 100, 250, 500, 1,000, doubling every couple of days while watching
   bounces. Send to your most engaged subscribers first — opens and replies are
   what build reputation.
2. **Send a test to yourself.** The *Send test* button in the compose modal.
   Check rendering in Gmail and Outlook, and check which folder it lands in.
3. **Score it.** Paste the address from [mail-tester.com](https://www.mail-tester.com)
   into the test field and send. Aim for 9/10 or better; it names each failure.
4. **Clean the list.** Remove addresses that hard-bounce. Never buy or import a
   list you did not collect — one spam-trap hit can undo months of reputation.

## 5. Writing campaigns that pass filters

- A specific, honest subject line. No `ALL CAPS`, no `!!!`, no "FREE", no
  "ACT NOW", no leading `Re:` or `Fwd:` on mail that is neither.
- Keep a sane text-to-image ratio. An email that is one big image with no text
  is a classic spam pattern.
- Link only to your own domain and reputable hosts. Never use link shorteners —
  they are shared infrastructure with spammers.
- Send on a predictable rhythm. Six months of silence followed by a blast reads
  as a list that no longer remembers subscribing.
- Watch complaints in the Resend dashboard. Above 0.3% something is wrong with
  the list or the expectations you set at signup.
