import React from "react";
import { Link } from "react-router-dom";
import { X, ArrowLeft } from "lucide-react";

export default function PaymentCancel() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6" data-testid="payment-cancel-page">
      <div className="w-full max-w-lg">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.25em] text-white/50 hover:text-[#FF5A1F] mb-8">
          <ArrowLeft size={14} /> HOME
        </Link>
        <div className="glass rounded-3xl p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-full border border-white/15 flex items-center justify-center mb-6">
            <X size={28} className="text-white/70" />
          </div>
          <p className="font-mono text-[10px] tracking-[0.3em] text-white/50 mb-3">— CHECKOUT CANCELLED</p>
          <h1 className="font-display text-4xl mb-3">NO WORRIES.</h1>
          <p className="text-white/60 text-sm mb-8">Your card was not charged. The tee is still waiting for you.</p>
          <Link to="/#merch" className="btn-primary inline-block" data-testid="cancel-back-merch">BACK TO STORE</Link>
        </div>
      </div>
    </div>
  );
}
