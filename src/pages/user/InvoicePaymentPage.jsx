import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import SignatureCanvas from "react-signature-canvas"
import { CheckCircle2, CreditCard, FileText, Loader2, Printer } from "lucide-react"
import { toast } from "sonner"
import { axiosInstance } from "../../store/axios/axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const TIP_PRESETS = [10, 20, 30]

function formatMoney(symbol, amount) {
  const n = Number(amount || 0)
  return `${symbol || "$"}${n.toFixed(2)}`
}

function formatAddress(addr) {
  if (!addr || typeof addr !== "object") return null
  const parts = [
    addr.addressLine1 || addr.line1 || addr.address,
    addr.city,
    addr.state,
    addr.postalCode || addr.postal_code || addr.zip,
  ].filter(Boolean)
  return parts.length ? parts.join(", ") : null
}

function formatDate(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
}

export default function InvoicePaymentPage() {
  const { jobId } = useParams()
  const sigRef = useRef(null)
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tipAmount, setTipAmount] = useState(0)
  const [customTip, setCustomTip] = useState("")
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false)
  const [signatureData, setSignatureData] = useState(null) // base64 PNG, no data: prefix
  const [submitting, setSubmitting] = useState(false)
  const [savingTip, setSavingTip] = useState(false)
  const awaitingPaymentReturnRef = useRef(false)

  const applyInvoiceData = useCallback((data, { preserveLocalSignature = false } = {}) => {
    setInvoice(data)
    const tip = Number(data.tip_amount || 0)
    setTipAmount(tip)
    setCustomTip(tip && !TIP_PRESETS.includes(tip) ? String(tip) : "")
    if (preserveLocalSignature) return
    if (data.has_signature && data.signature) {
      const raw = String(data.signature)
      setSignatureData(raw.includes(",") ? raw.split(",", 1)[1] : raw)
      setHasDrawnSignature(true)
    } else {
      setSignatureData(null)
      setHasDrawnSignature(false)
    }
  }, [])

  const loadInvoice = useCallback(
    async ({ silent = false, preserveLocalSignature = false } = {}) => {
      if (!jobId) return
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      try {
        const { data } = await axiosInstance.get(`/job/public/invoice/${jobId}/`)
        applyInvoiceData(data, { preserveLocalSignature })
      } catch (err) {
        if (!silent) {
          setError(err?.response?.data?.detail || "Failed to load invoice")
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [jobId, applyInvoiceData],
  )

  useEffect(() => {
    loadInvoice({ silent: false })
  }, [jobId]) // eslint-disable-line react-hooks/exhaustive-deps -- load once per job

  // After opening GHL pay tab, silently refresh when user returns (no full-page reload loop).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return
      if (!awaitingPaymentReturnRef.current) return
      awaitingPaymentReturnRef.current = false
      loadInvoice({ silent: true })
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [loadInvoice])

  const symbol = invoice?.currency_symbol || "$"
  const amountDueBase = Number(invoice?.amount_due ?? invoice?.total ?? 0)
  const displayDue = useMemo(() => {
    if (invoice?.is_paid) return 0
    // amount_due from GHL may already include prior tip; show tip delta on unpaid flow.
    const priorTip = Number(invoice?.tip_amount || 0)
    const nextTip = Number(tipAmount || 0)
    return Math.max(0, amountDueBase - priorTip + nextTip)
  }, [amountDueBase, invoice?.is_paid, invoice?.tip_amount, tipAmount])

  const selectTip = (value) => {
    setTipAmount(value)
    setCustomTip("")
  }

  const onCustomTip = (raw) => {
    setCustomTip(raw)
    const n = Number(raw)
    if (!Number.isNaN(n) && n >= 0) setTipAmount(n)
  }

  const clearSignature = () => {
    sigRef.current?.clear()
    setSignatureData(null)
    setHasDrawnSignature(false)
  }

  const persistSignatureFromCanvas = () => {
    try {
      const pad = sigRef.current
      if (!pad) return null
      const canvas = typeof pad.getCanvas === "function" ? pad.getCanvas() : null
      if (!canvas || !canvas.width || !canvas.height) return null
      const dataUrl = canvas.toDataURL("image/png")
      const b64 = dataUrl.includes(",") ? dataUrl.split(",", 1)[1] : dataUrl
      // Tiny / blank data URLs are useless
      if (!b64 || b64.length < 100) return null
      setSignatureData(b64)
      setHasDrawnSignature(true)
      return b64
    } catch {
      return null
    }
  }

  const captureSignature = () => {
    if (signatureData) return signatureData
    const fromCanvas = persistSignatureFromCanvas()
    if (fromCanvas) return fromCanvas
    if (invoice?.signature) {
      const raw = String(invoice.signature)
      return raw.includes(",") ? raw.split(",", 1)[1] : raw
    }
    return null
  }

  const savedTip = Number(invoice?.tip_amount || 0)
  const tipDirty = Number(tipAmount || 0) !== savedTip

  const handleSaveTip = async () => {
    setSavingTip(true)
    try {
      const { data } = await axiosInstance.post(`/job/public/invoice/${jobId}/prepare-payment/`, {
        tip_amount: tipAmount || 0,
        save_tip_only: true,
      })
      const next = data?.invoice || data
      // Keep signature the user already drew while tip save refreshes invoice totals.
      applyInvoiceData(next, { preserveLocalSignature: true })
      const meta = data?.meta || {}
      if (meta.ghl_updated) {
        toast.success("Tip saved — GHL invoice updated")
      } else {
        toast.message("Tip already up to date")
      }
      await loadInvoice({ silent: true, preserveLocalSignature: true })
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save tip")
    } finally {
      setSavingTip(false)
    }
  }

  const handlePay = async () => {
    setSubmitting(true)
    try {
      const signature = captureSignature() || ""
      // Persist tip (if changed) and optional signature — signature is never required to open GHL.
      const { data } = await axiosInstance.post(`/job/public/invoice/${jobId}/prepare-payment/`, {
        tip_amount: tipAmount || 0,
        signature,
        save_tip_only: true,
      })
      const next = data?.invoice || data
      applyInvoiceData(next, { preserveLocalSignature: true })
      const payUrl = next?.ghl_payment_url || invoice?.ghl_payment_url
      if (payUrl) {
        awaitingPaymentReturnRef.current = true
        window.open(payUrl, "_blank", "noopener,noreferrer")
        toast.success("Opening GoHighLevel payment page…")
      } else {
        toast.error("No GHL payment link is available for this invoice yet.")
      }
      await loadInvoice({ silent: true, preserveLocalSignature: true })
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to open payment")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <Alert className="max-w-lg">
          <AlertTitle>Invoice unavailable</AlertTitle>
          <AlertDescription>{error || "Invoice not found."}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const statusLabel = (invoice.status || "draft").replace(/_/g, " ")

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-xl bg-white shadow-lg print:shadow-none">
        <div className="flex items-start justify-between gap-4 bg-slate-800 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            {invoice.business?.logo_url ? (
              <img
                src={invoice.business.logo_url}
                alt=""
                className="h-12 w-12 rounded-full object-cover bg-white"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <FileText className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-white/70">Invoice</p>
              <h1 className="text-2xl font-semibold">
                {invoice.invoice_number ? `#${invoice.invoice_number}` : "Invoice"}
              </h1>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              invoice.is_paid ? "bg-emerald-500 text-white" : "bg-white/15 text-white"
            }`}
          >
            {invoice.is_paid ? "Paid" : statusLabel}
          </span>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">From</p>
              <p className="mt-1 font-medium text-slate-900">{invoice.business?.name || "—"}</p>
              {formatAddress(invoice.business?.address) && (
                <p className="text-sm text-slate-600">{formatAddress(invoice.business.address)}</p>
              )}
              {invoice.business?.phone && (
                <p className="text-sm text-slate-600">{invoice.business.phone}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Bill to</p>
              <p className="mt-1 font-medium text-slate-900">{invoice.bill_to?.name || "—"}</p>
              {formatAddress(invoice.bill_to?.address) && (
                <p className="text-sm text-slate-600">{formatAddress(invoice.bill_to.address)}</p>
              )}
              {invoice.bill_to?.email && (
                <p className="text-sm text-slate-600">{invoice.bill_to.email}</p>
              )}
              {invoice.bill_to?.phone && (
                <p className="text-sm text-slate-600">{invoice.bill_to.phone}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase text-slate-500">Invoice #</p>
              <p className="font-medium">{invoice.invoice_number ? `#${invoice.invoice_number}` : "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Issue date</p>
              <p className="font-medium">{formatDate(invoice.issue_date)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Due date</p>
              <p className="font-medium">{formatDate(invoice.due_date)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Amount due</p>
              <p className={`font-semibold ${invoice.is_paid ? "text-emerald-600" : "text-red-600"}`}>
                {formatMoney(symbol, displayDue)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Description</th>
                  <th className="py-2 pr-2">Qty</th>
                  <th className="py-2 pr-2">Unit price</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.items || []).map((item, idx) => (
                  <tr key={`${item.name}-${idx}`} className="border-b border-slate-100">
                    <td className="py-3 pr-2 font-medium text-slate-800">{item.name}</td>
                    <td className="py-3 pr-2">{Number(item.qty || 0).toFixed(2)}</td>
                    <td className="py-3 pr-2">{formatMoney(symbol, item.unit_price)}</td>
                    <td className="py-3 text-right">{formatMoney(symbol, item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span>{formatMoney(symbol, invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tax</span>
              <span>{formatMoney(symbol, invoice.tax_total)}</span>
            </div>
            {tipAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tip</span>
                <span>{formatMoney(symbol, tipAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>{invoice.is_paid ? "Total paid" : "Amount due"}</span>
              <span className={invoice.is_paid ? "text-emerald-600" : "text-red-600"}>
                {formatMoney(symbol, invoice.is_paid ? invoice.amount_paid || invoice.total : displayDue)}
              </span>
            </div>
          </div>

          {invoice.is_paid ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-600" />
              <p className="text-lg font-semibold text-emerald-900">Payment Received</p>
              <p className="mt-1 text-sm text-emerald-800">
                Thank you for your payment. This invoice has been marked as paid.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 rounded-xl border p-4">
                <p className="font-semibold text-slate-900">Add a tip (optional)</p>
                <div className="flex flex-wrap gap-2">
                  {TIP_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={tipAmount === preset && !customTip ? "default" : "outline"}
                      onClick={() => selectTip(preset)}
                    >
                      + {formatMoney(symbol, preset)}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={tipAmount === 0 ? "default" : "outline"}
                    onClick={() => selectTip(0)}
                  >
                    No tip
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-600">Custom:</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="max-w-[140px]"
                    value={customTip}
                    onChange={(e) => onCustomTip(e.target.value)}
                    placeholder="0.00"
                  />
                  <Button
                    type="button"
                    onClick={handleSaveTip}
                    disabled={savingTip || submitting || !tipDirty}
                  >
                    {savingTip ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {savingTip ? "Saving…" : "Save tip to invoice"}
                  </Button>
                </div>
                {tipDirty ? (
                  <p className="text-xs text-amber-700">
                    Tip not saved yet — click Save tip to update the GHL invoice.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Saved tip on invoice: {formatMoney(symbol, savedTip)}
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-xl border p-4">
                <div>
                  <p className="font-semibold text-slate-900">Digital Signature (optional)</p>
                  <p className="text-sm text-slate-600">
                    Optional — you can pay through GHL without signing.
                  </p>
                </div>
                {invoice.signature && !hasDrawnSignature ? (
                  <img
                    src={
                      invoice.signature.startsWith("data:")
                        ? invoice.signature
                        : `data:image/png;base64,${invoice.signature}`
                    }
                    alt="Saved signature"
                    className="h-40 w-full rounded-lg border bg-white object-contain"
                  />
                ) : null}
                <div className="overflow-hidden rounded-lg border bg-white">
                  <SignatureCanvas
                    ref={sigRef}
                    penColor="#0f172a"
                    canvasProps={{
                      className: "sig-canvas h-40 w-full touch-none",
                      width: 700,
                      height: 160,
                      style: { width: "100%", height: "160px" },
                    }}
                    onEnd={persistSignatureFromCanvas}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={clearSignature}>
                    Clear
                  </Button>
                </div>
              </div>

              <div className="rounded-xl bg-sky-50 p-4">
                <p className="mb-3 text-sm text-sky-900">
                  Save your tip first (optional), then open the GoHighLevel invoice to pay.
                </p>
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  disabled={submitting || savingTip}
                  onClick={handlePay}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Pay {formatMoney(symbol, displayDue)} through GHL
                </Button>
              </div>
            </>
          )}

          <p className="text-center text-sm text-slate-500">
            Thank you for your business!
            {invoice.business?.name ? ` ${invoice.business.name}` : ""}
          </p>
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-3xl justify-center print:hidden">
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print Invoice
        </Button>
      </div>
    </div>
  )
}
