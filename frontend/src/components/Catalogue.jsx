import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/api";
import { Play, ExternalLink } from "lucide-react";

export default function Catalogue() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/catalogue").then((r) => setItems(r.data)).catch(() => {});
  }, []);

  return (
    <section id="catalogue" className="px-8 md:px-12 py-24" data-testid="catalogue-section">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-[#FF5A1F] mb-3">— 01</p>
          <h2 className="font-display text-5xl md:text-6xl leading-none">{t("catalogue.title")}</h2>
        </div>
        <p className="font-mono text-xs tracking-[0.25em] text-white/50 hidden md:block">
          {t("catalogue.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4" data-testid="catalogue-grid">
        {items.map((v, idx) => (
          <article
            key={v.id}
            className="group glass glass-hover rounded-2xl overflow-hidden transition-colors duration-300"
            data-testid={`catalogue-card-${v.number}`}
          >
            <div className="aspect-square relative overflow-hidden bg-black">
              {v.cover_url ? (
                <img
                  src={v.cover_url}
                  alt={v.title}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                />
              ) : (
                <div
                  className="w-full h-full flex items-end p-5"
                  style={{
                    background: `radial-gradient(circle at ${30 + idx * 6}% ${40 + idx * 3}%, rgba(255,90,31,0.35), transparent 60%), #0a0a0a`,
                  }}
                >
                  <span className="font-display text-6xl md:text-7xl text-white/10 leading-none">
                    {v.number}
                  </span>
                </div>
              )}
              <div className="absolute top-3 right-3 font-mono text-[10px] tracking-[0.25em] text-white/50 bg-black/60 backdrop-blur px-2 py-1 rounded-full">
                {t("catalogue.volume")} {v.number}
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-display text-2xl mb-1 leading-none">{v.title}</h3>
              <p className="text-xs text-white/50 mb-4 line-clamp-2 min-h-[2.5rem]">{v.description}</p>
              {v.listen_url ? (
                <a
                  href={v.listen_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.2em] text-[#FF5A1F] hover:text-white transition-colors"
                  data-testid={`catalogue-listen-${v.number}`}
                >
                  <Play size={12} /> {t("catalogue.listen")}
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.2em] text-white/30">
                  <ExternalLink size={12} /> —
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
