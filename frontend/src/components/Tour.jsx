import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/api";
import { ArrowUpRight } from "lucide-react";

function fmtDate(iso, lang) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(lang || "fr", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  } catch {
    return iso;
  }
}

export default function Tour() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/tour").then((r) => setItems(r.data)).catch(() => {});
  }, []);

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
        {items.length === 0 && (
          <div className="p-10 text-center text-white/40 font-mono text-sm">—</div>
        )}
        {items.map((d, idx) => (
          <div
            key={d.id}
            className={`flex flex-col md:flex-row md:items-center gap-4 md:gap-8 px-6 md:px-8 py-6 group hover:bg-white/[0.03] transition-colors ${
              idx !== items.length - 1 ? "border-b border-white/5" : ""
            }`}
            data-testid={`tour-item-${idx}`}
          >
            <div className="w-full md:w-40 font-mono text-xs tracking-[0.2em] text-[#FF5A1F]">
              {fmtDate(d.date, i18n.language)}
            </div>
            <div className="flex-1">
              <div className="font-display text-3xl leading-none">{d.city}</div>
              <div className="text-sm text-white/50 mt-1">{d.venue}{d.country ? ` — ${d.country}` : ""}</div>
            </div>
            <div className="w-full md:w-auto">
              {d.status === "soldout" ? (
                <span className="font-mono text-xs tracking-[0.2em] text-white/40" data-testid={`tour-soldout-${idx}`}>
                  {t("tour.soldout")}
                </span>
              ) : (
                <a
                  href={d.ticket_url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost inline-flex items-center gap-2"
                  data-testid={`tour-tickets-${idx}`}
                >
                  {t("tour.tickets")} <ArrowUpRight size={14} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
