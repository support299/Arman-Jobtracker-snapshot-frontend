import { useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { axiosInstance } from "../../store/axios/axios"
import { useGetPublicClaimQuery } from "../../store/api/referralsApi"

const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    (Number(cents) || 0) / 100
  )

export default function ReferralClaimPage() {
  const { code } = useParams()
  const { data: claim, isLoading, error } = useGetPublicClaimQuery(code, { skip: !code })
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const [formError, setFormError] = useState("")

  const brandStyle = useMemo(
    () => ({
      "--brand": claim?.primary_color || "#1472e8",
      "--accent": claim?.accent_color || "#0c4fac",
    }),
    [claim]
  )

  async function submit(e) {
    e.preventDefault()
    setSubmitting(true)
    setFormError("")
    try {
      await axiosInstance.post("/referrals/public/claim/", {
        code,
        name,
        email,
        phone,
      })
      setComplete(true)
    } catch (err) {
      setFormError(err?.response?.data?.detail || "We could not claim this referral.")
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    )
  }

  if (error || !claim) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border bg-white p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <h1 className="text-xl font-semibold">Referral link unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">This link is invalid or the program is paused.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-slate-900" style={brandStyle}>
      <div className="bg-slate-900 text-center text-[10px] font-semibold tracking-[0.18em] text-slate-300 py-2">
        REFERRALS POWERED BY THE SERVICE PILOT
      </div>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          {claim.logo_url ? (
            <img src={claim.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div
              className="grid h-10 w-10 place-items-center rounded-lg text-white text-sm font-bold"
              style={{ background: "var(--brand)" }}
            >
              {(claim.short_name || "SP").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-semibold">{claim.short_name || claim.business_name}</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">{claim.service_label}</div>
          </div>
        </div>
        <div className="text-[10px] font-bold tracking-widest text-slate-500">PERSONAL REFERRAL</div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-5 py-8 lg:grid-cols-2 lg:items-start">
        <section>
          <p className="text-[10px] font-bold tracking-[0.18em]" style={{ color: "var(--brand)" }}>
            {String(claim.referrer_name || "").toUpperCase()} SENT YOU A THANK-YOU
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {money(claim.friend_reward_cents)} toward{" "}
            <em className="not-italic" style={{ color: "var(--brand)" }}>
              your first service.
            </em>
          </h1>
          <p className="mt-4 text-slate-600 leading-relaxed">
            {claim.referrer_name} recommends {claim.business_name}. Claim your welcome credit now; it unlocks after
            your first eligible paid invoice.
          </p>
          <div className="mt-6 flex items-center gap-4 rounded-2xl border bg-white p-4">
            <div>
              <div className="text-[10px] font-bold tracking-widest text-slate-500">YOU RECEIVE</div>
              <div className="text-2xl font-semibold">{money(claim.friend_reward_cents)}</div>
            </div>
            <div className="text-slate-300">+</div>
            <div>
              <div className="text-[10px] font-bold tracking-widest text-slate-500">
                {(claim.referrer_name || "FRIEND").split(" ")[0].toUpperCase()} RECEIVES
              </div>
              <div className="text-2xl font-semibold">{money(claim.referrer_reward_cents)}</div>
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border bg-white p-6 shadow-sm">
          {complete ? (
            <div className="text-center py-6">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-3 text-[10px] font-bold tracking-widest text-emerald-700">REFERRAL CLAIMED</p>
              <h2 className="mt-2 text-2xl font-semibold">Your {money(claim.friend_reward_cents)} is reserved.</h2>
              <p className="mt-2 text-sm text-slate-600">
                Book with {claim.short_name || claim.business_name} using the same email. Credit unlocks after your
                first qualifying invoice is paid.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-slate-500">CLAIM YOUR CREDIT</p>
                <h2 className="mt-1 text-xl font-semibold">Tell us where to attach it.</h2>
                <p className="text-sm text-slate-500">Use the same contact details when you book.</p>
              </div>
              <label className="block text-sm">
                Your name
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </label>
              <label className="block text-sm">
                Email address
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                Phone <span className="text-slate-400">(optional)</span>
                <input
                  type="tel"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--brand)" }}
              >
                {submitting ? "Reserving your credit…" : `Claim my ${money(claim.friend_reward_cents)} →`}
              </button>
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {formError}
                </div>
              )}
              <p className="text-xs text-slate-500">By claiming, you agree to the referral program terms below.</p>
            </form>
          )}
        </aside>
      </main>

      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="rounded-2xl border bg-white p-5">
          <strong className="text-sm">Good to know</strong>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{claim.terms_text}</p>
        </div>
      </section>
    </div>
  )
}
