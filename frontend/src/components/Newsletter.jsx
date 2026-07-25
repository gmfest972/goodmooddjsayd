import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/api";
import { toast } from "sonner";
import { Send } from "lucide-react";

export default function Newsletter() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { data } = await api.post("/newsletter", { email, lang: i18n.language });
      if (data.already) toast.info(t("newsletter.already"));
      else toast.success(t("newsletter.success"));
      setEmail("");
    } catch {
      toast.error(t("newsletter.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="newsletter" className="px-8 md:px-12 py-24" data-testid="newsletter-section">
      <div className="glass rounded-3xl p-10 md:p-14 relative overflow-hidden">
        <div className="grain" />
        <div className="relative z-10">
          <p className="font-mono text-xs tracking-[0.3em] text-[#FF5A1F] mb-3">— 04</p>
          <h2 className="font-display text-4xl md:text-5xl leading-none max-w-lg">{t("newsletter.title")}</h2>
          <p className="text-white/60 mt-4 max-w-md">{t("newsletter.subtitle")}</p>

          <form onSubmit={submit} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl" data-testid="newsletter-form">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("newsletter.placeholder")}
              className="flex-1 bg-black/50 border border-white/10 rounded-full px-6 py-4 text-white placeholder:text-white/30 focus:border-[#FF5A1F] focus:outline-none font-mono text-sm tracking-wider"
              data-testid="newsletter-email-input"
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2 justify-center disabled:opacity-60"
              data-testid="newsletter-submit-btn"
            >
              {t("newsletter.submit")} <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
