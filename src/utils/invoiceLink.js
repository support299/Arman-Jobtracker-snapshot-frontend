export const DEFAULT_INVOICE_LINK_BASE_URL = 'https://links.theservicepilot.com/';

/**
 * Normalize invoice link base URL from account settings.
 */
export function normalizeInvoiceLinkBaseUrl(baseUrl) {
  const base = (baseUrl || '').trim() || DEFAULT_INVOICE_LINK_BASE_URL;
  return base.endsWith('/') ? base : `${base}/`;
}

/**
 * Build customer-facing invoice URL from GHL invoice id and optional account base URL.
 */
export function buildInvoiceUrl(invoiceId, baseUrl) {
  const id = (invoiceId || '').trim();
  if (!id) return null;

  const base = normalizeInvoiceLinkBaseUrl(baseUrl);
  try {
    const parsed = new URL(base);
    const path = (parsed.pathname || '/').replace(/^\/|\/$/g, '');
    if (!path) {
      return `${base}invoice/${id}`;
    }
    return `${base}${id}`;
  } catch {
    return `${base}${id}`;
  }
}

/**
 * Resolve the invoice link shown in job UI.
 */
export function resolveJobInvoiceUrl(job, invoiceLinkBaseUrl) {
  if (!job) return null;
  if (job.invoice_view_url) return job.invoice_view_url;
  if (job.invoice_id) {
    return buildInvoiceUrl(job.invoice_id, invoiceLinkBaseUrl);
  }
  return job.invoice_url || null;
}
