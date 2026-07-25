import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/api";
import { ArrowUpRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";

function fmtDate(iso, lang) {
  try {
    return new Date(iso).toLocaleDateString(lang || "fr", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  } catch { return iso; }
}

function formatPrice(cents, currency = "eur") {
  const amount = (cents || 0) / 100;
  const symbol = (currency || "eur").toLowerCase() === "eur" ? "€" : currency.toUpperCase();
  return `${amount.toFixed(0)}${symbol}`;
}

function TicketPicker({ event, onClose }) {
  const { t } = useTranslation();
  const [tt, setTt] = useState(event.ticket_types?.[0] || null);
  const [qty, setQty] = useState(1);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const buy = async (e) => {
    e.preventDefault();
    if (!tt) return;
    setLoading(true);
    try {
      const { data } = await api.post("/payments/checkout", {
        lookup_key: tt.lookup_key,
        quantity: qty,
        variant: `${event.city} · ${tt.name}`,
        origin_url: window.location.origin,
        email,
      });
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error(err.response?.data?.detail || "Checkout failed");
      setLoading(false);
    }
  };

  if (!event.ticket_types || event.ticket_types.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose} data-testid="ticket-picker">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl w-full max-w-md p-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-display text-2xl">{event.name}</h3>
            <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
          </div>
          <p className="text-white/60 text-sm">No ticket types available yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose} data-testid="ticket-picker">
      <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl w-full max-w-md p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-[#FF5A1F] mb-1">— {fmtDate(event.date, "fr")}</p>
            <h3 className="font-display text-2xl leading-none">{event.name}</h3>
            <p className="text-xs text-white/50 mt-1">{event.venue} · {event.city}</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white" data-testid="ticket-picker-close"><X size={18} /></button>
        </div>

        <form onSubmit={buy} className="space-y-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-white/50 mb-3">TICKET TYPE</p>
            <div className="space-y-2">
              {event.ticket_types.map((t) => {
                const soldOut = t.remaining <= 0;
                return (
                  <button
                    type="button"
                    key={t.id}
                    disabled={soldOut}
                    onClick={() => setTt(t)}
                    className={`w-full flex justify-between items-center p-3 rounded-lg border transition-colors ${
                      tt?.id === t.id ? "border-[#FF5A1F] bg-[#FF5A1F]/10" :
                      soldOut ? "border-white/5 opacity-40 cursor-not-allowed" :
                      "border-white/10 hover:border-white/30"
                    }`}
                    data-testid={`tt-option-${t.id}`}
                  >
                    <div className="text-left">
                      <div className="font-display text-lg leading-none">{t.name}</div>
                      <div className="text-[10px] font-mono text-white/50 mt-1">
                        {soldOut ? "SOLD OUT" : `${t.remaining} LEFT`}
                      </div>
                    </div>
                    <div className="font-mono text-[#FF5A1F]">{formatPrice(t.price_cents, event.currency)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-white/50 mb-2">EMAIL</p>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#FF5A1F] focus:outline-none"
              data-testid="ticket-email-input" />
          </div>

          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-white/50 mb-2">QUANTITY</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 rounded-full border border-white/15 hover:border-[#FF5A1F]">−</button>
              <span className="font-display text-xl w-8 text-center" data-testid="ticket-qty">{qty}</span>
              <button type="button" onClick={() => setQty(Math.min(10, qty + 1))} className="w-9 h-9 rounded-full border border-white/15 hover:border-[#FF5A1F]">+</button>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-widest text-white/50">TOTAL</div>
              <div className="font-display text-2xl text-[#FF5A1F]" data-testid="ticket-total">
                {tt ? formatPrice(tt.price_cents * qty, event.currency) : "—"}
              </div>
            </div>
            <button type="submit" disabled={loading || !tt} className="btn-primary flex items-center gap-2" data-testid="ticket-checkout-btn">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null} CHECKOUT
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Tour() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState([]);
  const [picking, setPicking] = useState(null);

  useEffect(() => {
    api.get("/events").then((r) => setItems(r.data)).catch(() => {});
  }, []);

  const upcoming = items.filter((d) => d.status !== "past");

  return (
    <section id="tour" className="px-8 md:px-12 py-24" data-testid="tour-section">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-[#FF5A1F] mb-3">— 02</p>
          <h2 className="font-display text-5xl md:text-6xl leading-none">{t("tour.title")}</h2>
        </div>
        <p className="font-mono text-xs tracking-[0.25em] text-white/50 hidden md:block">{t("tour.subtitle")}</p>
      </div>

      <div className="glass rounded-2xl overflow-hidden" data-testid="tour-list">
        {upcoming.length === 0 && (
          <div className="p-10 text-center text-white/40 font-mono text-sm">—</div>
        )}
        {upcoming.map((d, idx) => {
          const cheapest = (d.ticket_types || []).reduce((min, t) =>
            !min || t.price_cents < min.price_cents ? t : min, null);
          return (
            <div key={d.id}
              className={`flex flex-col md:flex-row md:items-center gap-4 md:gap-8 px-6 md:px-8 py-6 group hover:bg-white/[0.03] transition-colors ${
                idx !== upcoming.length - 1 ? "border-b border-white/5" : ""
              }`}
              data-testid={`tour-item-${idx}`}>
              <div className="w-full md:w-40 font-mono text-xs tracking-[0.2em] text-[#FF5A1F]">
                {fmtDate(d.date, i18n.language)}
              </div>
              <div className="flex-1">
                <div className="font-display text-3xl leading-none">{d.city}</div>
                <div className="text-sm text-white/50 mt-1">{d.venue}{d.country ? ` — ${d.country}` : ""}</div>
                {cheapest && d.status === "on_sale" && (
                  <div className="mt-2 font-mono text-[10px] tracking-[0.25em] text-[#FF5A1F]">
                    FROM {formatPrice(cheapest.price_cents, d.currency)}
                  </div>
                )}
              </div>
              <div className="w-full md:w-auto">
                {d.status === "sold_out" ? (
                  <span className="font-mono text-xs tracking-[0.2em] text-white/40" data-testid={`tour-soldout-${idx}`}>{t("tour.soldout")}</span>
                ) : d.status === "announced" ? (
                  <span className="btn-ghost inline-block opacity-60 cursor-not-allowed" data-testid={`tour-soon-${idx}`}>{t("tour.soon")}</span>
                ) : d.status === "on_sale" && d.ticket_types && d.ticket_types.length > 0 ? (
                  <button onClick={() => setPicking(d)} className="btn-primary inline-flex items-center gap-2" data-testid={`tour-tickets-${idx}`}>
                    {t("tour.tickets")} <ArrowUpRight size={14} />
                  </button>
                ) : d.ticket_url ? (
                  <a href={d.ticket_url} target="_blank" rel="noreferrer" className="btn-ghost inline-flex items-center gap-2" data-testid={`tour-tickets-${idx}`}>
                    {t("tour.tickets")} <ArrowUpRight size={14} />
                  </a>
                ) : (
                  <span className="font-mono text-[10px] tracking-[0.2em] text-white/30">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {picking && <TicketPicker event={picking} onClose={() => setPicking(null)} />}
    </section>
  );
}
