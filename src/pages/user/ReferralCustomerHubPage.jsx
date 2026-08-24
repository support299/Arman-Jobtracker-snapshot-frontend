import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Check, Copy, Loader2 } from "lucide-react"
import { useGetCustomerHubQuery, useGetPublicProgramQuery } from "../../store/api/referralsApi"
import { getIframeLocationId } from "../../utils/iframeContext"

const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    (Number(cents) || 0) / 100
  )

export default function ReferralCustomerHubPage() {
  const [params] = useSearchParams()
  const code = (params.get("code") || "").trim()
  const locationId = params.get("location_id") || getIframeLocationId() || ""
  const { data: hub, isLoading, error } = useGetCustomerHubQuery(code, { skip: !code })
  const { data: program } = useGetPublicProgramQuery(locationId, { skip: !locationId || !!hub })
  const [copied, setCopied] = useState(false)

  const brand = hub || program
  const brandStyle = useMemo(
    () => ({
      "--brand": brand?.primary_color || "#1472e8",
      "--accent": brand?.accent_color || "#0c4fac",
    }),
    [brand]
  )

  const shareUrl = hub?.share_url || ""
  const shareMessage = hub
    ? `I use ${hub.business_name} and thought you might like them too. Use my link and you’ll get ${money(hub.friend_reward_cents)} in service credit: ${shareUrl}`
    : ""

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  if (code && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f7fa]" style={brandStyle}>
      <div className="bg-slate-900 text-center text-[10px] font-semibold tracking-[0.18em] text-slate-300 py-2">
        REFERRALS POWERED BY THE SERVICE PILOT
      </div>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-[10px] font-bold tracking-[0.18em]" style={{ color: "var(--brand)" }}>
          A THANK-YOU THAT GOES BOTH WAYS
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Give {money(hub?.friend_reward_cents ?? program?.friend_reward_cents)}.{" "}
          <em className="not-italic" style={{ color: "var(--brand)" }}>
            Get {money(hub?.reward_cents ?? program?.referrer_reward_cents)}.
          </em>
        </h1>
        <p className="mt-3 text-slate-600">
          Know someone who could use {hub?.service_label || program?.service_label || "your service"}? Share your
          personal link. After their first eligible paid invoice, you both get credit.
        </p>

        <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          {!code && (
            <p className="text-sm text-slate-600">
              Open the link from your invitation email or text to see your personal referral hub.
            </p>
          )}
          {code && error && (
            <p className="text-sm text-red-600">We could not find that referral account.</p>
          )}
          {hub && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest text-slate-500">YOUR REFERRAL LINK</span>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">ACTIVE</span>
              </div>
              <h2 className="mt-3 text-xl font-semibold">Nice to see you, {hub.name.split(" ")[0]}.</h2>
              <div className="mt-4 flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2">
                <span className="flex-1 truncate text-sm">{shareUrl.replace(/^https?:\/\//, "")}</span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                  style={{ background: "var(--brand)" }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  className="rounded-lg border px-3 py-2 text-sm font-semibold"
                  href={`sms:?&body=${encodeURIComponent(shareMessage)}`}
                >
                  Text a friend
                </a>
                <a
                  className="rounded-lg border px-3 py-2 text-sm font-semibold"
                  href={`mailto:?subject=${encodeURIComponent(`${money(hub.friend_reward_cents)} toward ${hub.business_name}`)}&body=${encodeURIComponent(shareMessage)}`}
                >
                  Send email
                </a>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-3">
                  <div className="text-[10px] font-bold tracking-widest text-slate-500">AVAILABLE CREDIT</div>
                  <div className="text-2xl font-semibold">{money(hub.available_credit_cents)}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-[10px] font-bold tracking-widest text-slate-500">SUCCESSFUL</div>
                  <div className="text-2xl font-semibold">
                    {hub.referrals.filter((r) => r.status === "qualified").length}
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <h3 className="text-sm font-semibold">Your referrals</h3>
                <ul className="mt-2 space-y-2">
                  {hub.referrals.length === 0 && (
                    <li className="text-sm text-slate-500">No referrals yet — share your link to get started.</li>
                  )}
                  {hub.referrals.map((r, idx) => (
                    <li key={`${r.friend_name}-${idx}`} className="flex justify-between text-sm border-b py-2">
                      <span>{r.friend_name}</span>
                      <span className="capitalize text-slate-500">{r.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
