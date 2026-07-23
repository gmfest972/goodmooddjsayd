import React from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";
import { Link } from "react-router-dom";

export default function TopNav() {
  const { t } = useTranslation();
  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-6 md:px-12 py-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-[#FF5A1F] shadow-[0_0_12px_#FF5A1F]" />
        <span className="font-display text-2xl tracking-widest">GOOD MOOD</span>
      </div>
      <nav className="hidden md:flex items-center gap-8 font-mono text-xs tracking-[0.25em] text-white/70">
        <a href="#catalogue" className="hover:text-[#FF5A1F] transition-colors" data-testid="nav-catalogue">{t("nav.catalogue")}</a>
        <a href="#tour" className="hover:text-[#FF5A1F] transition-colors" data-testid="nav-tour">{t("nav.tour")}</a>
        <a href="#newsletter" className="hover:text-[#FF5A1F] transition-colors" data-testid="nav-newsletter">{t("nav.newsletter")}</a>
        <Link to="/admin/login" className="hover:text-[#FF5A1F] transition-colors" data-testid="nav-admin">{t("nav.admin")}</Link>
      </nav>
      <LanguageSwitcher />
    </header>
  );
}
