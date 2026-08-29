import { env } from '../config/env.js';

/**
 * Builds the wire format of a newsletter message.
 *
 * Everything here exists to survive a spam filter rather than to look clever.
 * The shell is a nested table with inline styles because Gmail strips `<style>`
 * blocks and Outlook renders with Word's engine; a plain-text alternative always
 * accompanies the HTML because HTML-only mail scores badly on its own; and the
 * List-Unsubscribe headers are what Gmail and Yahoo have required of bulk senders
 * since February 2024.
 */

const BRAND = '#2563eb';
const TEXT = '#111827';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';
const CANVAS = '#f3f4f6';

export interface NewsletterMessageParts {
  html: string;
  text: string;
  headers: Record<string, string>;
}

/**
 * The wordmark in the header comes from the display name on NEWSLETTER_FROM rather
 * than a second hardcoded copy, so the name in the inbox sender line and the name at
 * the top of the email cannot drift apart when one of them is changed.
 */
function brandName(): string {
  const match = env.NEWSLETTER_FROM.match(/^\s*"?([^"<]+?)"?\s*</);
  return match?.[1]?.trim() || 'AcousticsFX';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/**
 * Renders the body HTML down to readable plain text for the multipart alternative.
 * Links keep their target in parentheses so the text part is genuinely usable, not
 * a stub — filters compare the two parts, and a token text half is worse than none.
 */
export function htmlToPlainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
        const text = String(label).replace(/<[^>]*>/g, '').trim();
        return text && text !== href ? `${text} (${href})` : String(href);
      })
      .replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi, (_m, alt) => (alt ? `\n[${alt}]\n` : ''))
      .replace(/<img\b[^>]*>/gi, '')
      .replace(/<li\b[^>]*>/gi, '\n  - ')
      // `li` is absent here on purpose: its opener already starts the line, so closing
      // it with a blank line would double-space every list.
      .replace(/<\/li>/gi, '')
      .replace(/<\/(p|div|h[1-6]|ul|ol|blockquote|tr)>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Table-based shell. Widths and colours are inline; nothing depends on a stylesheet surviving. */
function wrapHtml(subject: string, bodyHtml: string, unsubscribeUrl: string): string {
  const site = env.PUBLIC_SITE_URL.replace(/\/+$/, '');
  const address = env.NEWSLETTER_POSTAL_ADDRESS.trim();

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${CANVAS};-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CANVAS};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${BORDER};border-radius:8px;">
  <tr>
    <td style="padding:24px 32px;border-bottom:1px solid ${BORDER};">
      <a href="${site}" style="color:${BRAND};font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;text-decoration:none;">${escapeHtml(brandName())}</a>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${TEXT};">
${bodyHtml}
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px;border-top:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};">
      <p style="margin:0 0 8px 0;">You are receiving this because you subscribed to updates at <a href="${site}" style="color:${MUTED};">acousticsfx.com</a>.</p>
      ${address ? `<p style="margin:0 0 8px 0;">${escapeHtml(address)}</p>` : ''}
      <p style="margin:0;"><a href="${unsubscribeUrl}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a></p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function plainTextFooter(unsubscribeUrl: string): string {
  const address = env.NEWSLETTER_POSTAL_ADDRESS.trim();
  const lines = [
    '',
    '',
    '—',
    `You are receiving this because you subscribed to updates at ${env.PUBLIC_SITE_URL}.`,
  ];
  if (address) lines.push(address);
  lines.push(`Unsubscribe: ${unsubscribeUrl}`);
  return lines.join('\n');
}

/**
 * Headers every newsletter message carries. `List-Unsubscribe-Post` is the half that
 * matters most: it tells Gmail and Yahoo the https URL accepts a one-click POST, which
 * turns their "unsubscribe" button into a silent request instead of a spam report.
 */
export function newsletterHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:${env.NEWSLETTER_UNSUBSCRIBE_MAILBOX}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'List-Id': env.NEWSLETTER_LIST_ID,
  };
}

export function buildNewsletterMessage(
  subject: string,
  bodyHtml: string,
  unsubscribeUrl: string
): NewsletterMessageParts {
  return {
    html: wrapHtml(subject, bodyHtml, unsubscribeUrl),
    text: htmlToPlainText(bodyHtml) + plainTextFooter(unsubscribeUrl),
    headers: newsletterHeaders(unsubscribeUrl),
  };
}
