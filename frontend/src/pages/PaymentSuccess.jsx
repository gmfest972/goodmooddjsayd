import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "@/api";
import { Check, Loader2, ArrowLeft } from "lucide-react";

export default function PaymentSuccess() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id");
  const [state, setState] = useState({ loading: true, paid: false, data: null, error: null });
  const attempts = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setState({ loading: false, paid: false, data: null, error: "Missing session id" });
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (cancelled) return;
        if (data.payment_status === "paid") {
          setState({ loading: false, paid: true, data, error: null });
          return;
        }
        if (attempts.current++ < 15) {
          setTimeout(poll, 2000);
        } else {
          setState({ loading: false, paid: false, data, error: "Timeout — check email" });
        }
      } catch (err) {
        setState({ loading: false, paid: false, data: null, error: err.response?.data?.detail || "Error" });
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  const formatPrice = (cents, cur) => cents == null ? "" : `${(cents / 100).toFixed(0)}${(cur || "eur").toLowerCase() === "eur" ? "€" : cur.toUpperCase()}`;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6" data-testid="payment-success-page">
      <div className="w-full max-w-lg">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.25em] text-white/50 hover:text-[#FF5A1F] mb-8">
          <ArrowLeft size={14} /> HOME
        </Link>
        <div className="glass rounded-3xl p-10 text-center">
          {state.loading ? (
            <>
              <Loader2 size={40} className="mx-auto text-[#FF5A1F] animate-spin mb-6" />
              <h1 className="font-display text-3xl mb-2">CONFIRMING PAYMENT</h1>
              <p className="text-white/50 text-sm">Hang tight — we're syncing with Stripe.</p>
            </>
          ) : state.paid ? (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#FF5A1F] to-[#C81E3A] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,90,31,0.4)]">
                <Check size={28} />
              </div>
              <p className="font-mono text-[10px] tracking-[0.3em] text-[#FF5A1F] mb-3">— ORDER CONFIRMED</p>
              <h1 className="font-display text-4xl mb-3">MERCI.</h1>
              <p className="text-white/60 text-sm mb-8">
                You're officially in the Good Mood family.<br/>
                We'll email shipping details shortly.
              </p>
              {state.data?.amount_cents != null && (
                <div className="pt-6 border-t border-white/5 flex justify-between items-center font-mono text-xs tracking-widest">
                  <span className="text-white/40">TOTAL PAID</span>
                  <span className="text-[#FF5A1F]" data-testid="payment-amount">{formatPrice(state.data.amount_cents, state.data.currency)}</span>
                </div>
              )}
              <Link to="/" className="btn-primary inline-block mt-8" data-testid="payment-back-home">BACK HOME</Link>
            </>
          ) : (
            <>
              <p className="font-mono text-[10px] tracking-[0.3em] text-white/50 mb-3">— STATUS</p>
              <h1 className="font-display text-3xl mb-3">STILL PROCESSING</h1>
              <p className="text-white/60 text-sm mb-8">{state.error || "We're waiting on Stripe. You'll receive an email as soon as it clears."}</p>
              <Link to="/" className="btn-ghost inline-block" data-testid="payment-back-home">BACK HOME</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
