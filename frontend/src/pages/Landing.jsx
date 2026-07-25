import React from "react";
import { useTranslation } from "react-i18next";
import Hero3DCanvas from "@/components/Hero3DCanvas";
import TopNav from "@/components/TopNav";
import Catalogue from "@/components/Catalogue";
import Tour from "@/components/Tour";
import Merch from "@/components/Merch";
import Newsletter from "@/components/Newsletter";
import { ArrowRight } from "lucide-react";

const CITIES = ["PARIS", "FORT-DE-FRANCE", "POINTE-À-PITRE", "MIAMI", "LONDON", "DAKAR", "TOKYO"];

export default function Landing() {
  const { t } = useTranslation();

  const scrollToNewsletter = () => {
    document.getElementById("newsletter")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative min-h-screen bg-[#050505] text-white">
      <TopNav />

      {/* HERO */}
      <section className="relative h-screen w-full overflow-hidden" data-testid="hero-section">
        <Hero3DCanvas />
        <div className="grain" />
        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(circle at 30% 40%, transparent 0%, rgba(5,5,5,0.7) 80%)",
        }} />

        <div className="relative z-10 h-full flex items-center px-8 md:px-16">
          <div className="max-w-4xl">
            <p className="font-mono text-xs tracking-[0.3em] text-[#FF5A1F] mb-6 flex items-center gap-3">
              <span className="w-8 h-px bg-[#FF5A1F]" />
              {t("hero.tag")}
            </p>
            <h1 className="font-display text-[18vw] md:text-[10vw] leading-[0.82] tracking-tight">
              <span className="block">{t("hero.line1")}</span>
              <span className="block text-[#FF5A1F]">{t("hero.line2")}</span>
            </h1>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <button className="btn-primary inline-flex items-center gap-3" onClick={scrollToNewsletter} data-testid="hero-cta-btn">
                {t("hero.cta")} <ArrowRight size={18} />
              </button>
              <a href="#catalogue" className="font-mono text-xs tracking-[0.25em] text-white/60 hover:text-[#FF5A1F] transition-colors" data-testid="hero-scroll-link">
                ↓ {t("hero.scroll")}
              </a>
            </div>
          </div>
        </div>

        {/* Bottom marquee */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/5 py-4 bg-black/40 backdrop-blur-sm overflow-hidden">
          <div className="marquee-track font-display text-2xl md:text-3xl text-white/40">
            {[...CITIES, ...CITIES, ...CITIES].map((c, i) => (
              <span key={i} className="flex items-center gap-6">
                {c}
                <span className="text-[#FF5A1F]">✦</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-orange" />

      <main className="relative z-10 max-w-7xl mx-auto">
        <Catalogue />
        <div className="divider-orange opacity-40" />
        <Tour />
        <div className="divider-orange opacity-40" />
        <Merch />
        <div className="divider-orange opacity-40" />
        <Newsletter />
      </main>

      <footer className="border-t border-white/5 py-12 px-8 md:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 items-start">
          <div className="flex items-center gap-3">
            <img src="/logo-gm.png" alt="Good Mood" className="h-12 w-12 object-contain" style={{ filter: "invert(1) brightness(1.1)" }} />
            <div>
              <div className="font-display text-2xl tracking-widest leading-none">GOOD MOOD</div>
              <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 mt-1">DJ SAYD — LIVE & RECORDS</div>
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-[#FF5A1F] mb-4">— FOLLOW</p>
            <div className="flex flex-col gap-2 font-mono text-xs tracking-widest text-white/60">
              <a href="https://www.instagram.com/goodmood.fest" target="_blank" rel="noreferrer" className="hover:text-[#FF5A1F] transition-colors" data-testid="social-ig-goodmood">
                INSTAGRAM · @GOODMOOD.FEST →
              </a>
              <a href="https://www.instagram.com/sayd_artist" target="_blank" rel="noreferrer" className="hover:text-[#FF5A1F] transition-colors" data-testid="social-ig-sayd">
                INSTAGRAM · @SAYD_ARTIST →
              </a>
              <a href="https://youtube.com/@djsaydvevo8145" target="_blank" rel="noreferrer" className="hover:text-[#FF5A1F] transition-colors" data-testid="social-vevo">
                YOUTUBE · DJ SAYD VEVO →
              </a>
              <a href="https://soundcloud.com/s-yd-l-ma-li/sets/good-mood-by-dj-sayd" target="_blank" rel="noreferrer" className="hover:text-[#FF5A1F] transition-colors" data-testid="social-soundcloud">
                SOUNDCLOUD · FULL SERIES →
              </a>
            </div>
          </div>

          <div className="md:text-right">
            <p className="font-mono text-[10px] tracking-[0.3em] text-[#FF5A1F] mb-4">— CVLN GROUPE</p>
            <p className="font-mono text-[10px] tracking-[0.25em] text-white/40 leading-relaxed">
              GOOD MOOD IS PART OF CVLN GROUPE HOLDING · PÔLE EVENTS · PARIS · CARAÏBES · WORLD
            </p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-white/5 flex justify-between items-center">
          <p className="font-mono text-[10px] tracking-[0.25em] text-white/40">{t("footer.rights")}</p>
          <p className="font-mono text-[10px] tracking-[0.25em] text-white/30">DESIGNED IN THE DARK · BUILT ON EMERGENT</p>
        </div>
      </footer>
    </div>
  );
}
