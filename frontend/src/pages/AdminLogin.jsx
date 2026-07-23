import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/api";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function AdminLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("gm_token", data.token);
      localStorage.setItem("gm_admin", JSON.stringify(data.user));
      toast.success("Welcome back.");
      navigate("/admin");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6" data-testid="admin-login-page">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.25em] text-white/50 hover:text-[#FF5A1F] mb-8">
          <ArrowLeft size={14} /> HOME
        </Link>
        <div className="glass rounded-2xl p-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-2 rounded-full bg-[#FF5A1F]" />
            <span className="font-display text-2xl tracking-widest">GOOD MOOD</span>
          </div>
          <h1 className="font-display text-4xl mb-2">{t("admin.title")}</h1>
          <p className="text-white/50 text-sm mb-8 font-mono tracking-wider">{t("admin.login").toUpperCase()}</p>

          <form onSubmit={submit} className="space-y-4" data-testid="admin-login-form">
            <div>
              <label className="text-xs font-mono tracking-[0.25em] text-white/50 uppercase">{t("admin.email")}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-2 bg-black/60 border border-white/10 rounded-lg px-4 py-3 focus:border-[#FF5A1F] focus:outline-none"
                data-testid="admin-email-input"
              />
            </div>
            <div>
              <label className="text-xs font-mono tracking-[0.25em] text-white/50 uppercase">{t("admin.password")}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-2 bg-black/60 border border-white/10 rounded-lg px-4 py-3 focus:border-[#FF5A1F] focus:outline-none"
                data-testid="admin-password-input"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-6" data-testid="admin-signin-btn">
              {loading ? "..." : t("admin.signin")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
