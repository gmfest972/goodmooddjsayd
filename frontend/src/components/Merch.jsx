import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/api";
import { ShoppingBag, Loader2 } from "lucide-react";
import { toast } from "sonner";

function formatPrice(cents, currency = "eur") {
  const amount = (cents || 0) / 100;
  const symbol = currency.toLowerCase() === "eur" ? "€" : currency.toUpperCase();
  return `${amount.toFixed(0)}${symbol}`;
}

function ProductCard({ product }) {
  const { t } = useTranslation();
  const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
  const [size, setSize] = useState(hasSizes ? product.sizes[0] : "");
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);

  const buy = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/payments/checkout", {
        lookup_key: product.lookup_key,
        quantity: qty,
        size,
        origin_url: window.location.origin,
      });
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error(err.response?.data?.detail || "Checkout failed");
      setLoading(false);
    }
  };

  return (
    <article className="glass rounded-3xl overflow-hidden group" data-testid={`merch-card-${product.id}`}>
      <div className="grid md:grid-cols-2 gap-0">
        <div className="aspect-square relative overflow-hidden bg-black">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] to-black flex items-center justify-center">
              <ShoppingBag size={64} className="text-[#FF5A1F]/40" />
            </div>
          )}
          <div className="absolute top-4 left-4 font-mono text-[10px] tracking-[0.3em] text-[#FF5A1F] bg-black/60 backdrop-blur px-3 py-1.5 rounded-full">
            {t("merch.drop")} · 001
          </div>
        </div>

        <div className="p-8 md:p-10 flex flex-col">
          <h3 className="font-display text-4xl md:text-5xl leading-none mb-4">{product.name}</h3>
          <p className="text-white/60 text-sm leading-relaxed mb-6">{product.description}</p>

          {hasSizes && (
            <div className="mb-6">
              <p className="font-mono text-[10px] tracking-[0.3em] text-white/50 mb-3">{t("merch.size")}</p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`min-w-11 h-11 px-3 rounded-full font-mono text-xs tracking-widest border transition-colors ${
                      size === s
                        ? "bg-[#FF5A1F] border-[#FF5A1F] text-black"
                        : "border-white/15 text-white/70 hover:border-[#FF5A1F] hover:text-white"
                    }`}
                    data-testid={`merch-size-${s}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <p className="font-mono text-[10px] tracking-[0.3em] text-white/50 mb-3">{t("merch.qty")}</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-9 h-9 rounded-full border border-white/15 hover:border-[#FF5A1F] transition-colors"
                data-testid="merch-qty-dec"
              >
                −
              </button>
              <span className="font-display text-2xl w-8 text-center" data-testid="merch-qty-value">{qty}</span>
              <button
                onClick={() => setQty(Math.min(10, qty + 1))}
                className="w-9 h-9 rounded-full border border-white/15 hover:border-[#FF5A1F] transition-colors"
                data-testid="merch-qty-inc"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-auto flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pt-6 border-t border-white/5">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] text-white/50">{t("merch.total")}</p>
              <p className="font-display text-4xl text-[#FF5A1F]" data-testid="merch-total">
                {formatPrice(product.price_cents * qty, product.currency)}
              </p>
            </div>
            <button
              onClick={buy}
              disabled={loading}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
              data-testid={`merch-buy-${product.id}`}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ShoppingBag size={16} />}
              {t("merch.buy")}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Merch() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/merch").then((r) => setItems(r.data)).catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <section id="merch" className="px-8 md:px-12 py-24" data-testid="merch-section">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-[#FF5A1F] mb-3">— 03</p>
          <h2 className="font-display text-5xl md:text-6xl leading-none">{t("merch.title")}</h2>
        </div>
        <p className="font-mono text-xs tracking-[0.25em] text-white/50 hidden md:block">{t("merch.subtitle")}</p>
      </div>

      <div className="space-y-6" data-testid="merch-list">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
