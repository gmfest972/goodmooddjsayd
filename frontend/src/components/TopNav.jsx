import React from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";
import { Link } from "react-router-dom";

export default function TopNav() {
  const { t } = useTranslation();
  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-6 md:px-12 py-4 flex items-center justify-between">
      <a href="#top" className="flex items-center gap-3" data-testid="brand-link">
        <img
          src="/logo-gm.png"
          alt="Good Mood"
          className="h-10 w-10 object-contain"
          style={{ filter: "invert(1) brightness(1.1)" }}
        />
        <span className="font-display text-xl tracking-widest hidden sm:inline">GOOD MOOD</span>
      </a>
      <nav className="hidden md:flex items-center gap-8 font-mono text-xs tracking-[0.25em] text-white/70">
        <a href="#catalogue" className="hover:text-[#FF5A1F] transition-colors" data-testid="nav-catalogue">{t("nav.catalogue")}</a>
        <a href="#tour" className="hover:text-[#FF5A1F] transition-colors" data-testid="nav-tour">{t("nav.tour")}</a>
        <a href="#merch" className="hover:text-[#FF5A1F] transition-colors" data-testid="nav-merch">{t("nav.merch")}</a>
        <a href="#newsletter" className="hover:text-[#FF5A1F] transition-colors" data-testid="nav-newsletter">{t("nav.newsletter")}</a>
        <Link to="/admin/login" className="hover:text-[#FF5A1F] transition-colors" data-testid="nav-admin">{t("nav.admin")}</Link>
      </nav>
      <LanguageSwitcher />
    </header>
  );
}
