import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";

const LANGS = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "kr", label: "KR" },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === i18n.language) || LANGS[0];

  const switchTo = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem("gm_lang", code);
    setOpen(false);
  };

  return (
    <div className="relative" data-testid="lang-switcher">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-black/40 hover:border-[#FF5A1F] transition-colors font-mono text-xs tracking-[0.2em]"
        data-testid="lang-switcher-btn"
      >
        {current.label}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-28 rounded-xl overflow-hidden glass z-50">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => switchTo(l.code)}
              className={`w-full text-left px-4 py-2 font-mono text-xs tracking-[0.2em] hover:bg-white/5 transition-colors ${
                l.code === current.code ? "text-[#FF5A1F]" : "text-white"
              }`}
              data-testid={`lang-option-${l.code}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
