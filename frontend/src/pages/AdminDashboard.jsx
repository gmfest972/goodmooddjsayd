import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { API } from "@/api";
import { toast } from "sonner";
import { LogOut, Plus, Pencil, Trash2, Download, Music, Calendar, Mail, ShoppingBag, Receipt } from "lucide-react";

const EMPTY_VOLUME = { number: "", title: "", year: "", plays: "", description: "", cover_url: "", listen_url: "", sc_track: null, order: 0 };
const EMPTY_TOUR = { city: "", venue: "", country: "", date: "", ticket_url: "", status: "available", price_cents: null, currency: "eur" };
const EMPTY_PRODUCT = { name: "", description: "", image_url: "", price_cents: 3500, currency: "eur", category: "", variant_label: "", variants: [], active: true, order: 0 };

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl w-full max-w-lg p-8" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-2xl mb-6">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function VolumeForm({ initial, onSave, onCancel, t }) {
  const [f, setF] = useState(initial || EMPTY_VOLUME);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="space-y-3" data-testid="volume-form">
      <div className="grid grid-cols-2 gap-3">
        <input required placeholder="Number (e.g. 01)" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="volume-number-input" />
        <input type="number" placeholder="Order" value={f.order} onChange={(e) => setF({ ...f, order: parseInt(e.target.value) || 0 })} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="volume-order-input" />
      </div>
      <input required placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="volume-title-input" />
      <div className="grid grid-cols-3 gap-3">
        <input placeholder="Year (2022)" value={f.year || ""} onChange={(e) => setF({ ...f, year: e.target.value })} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="volume-year-input" />
        <input placeholder="Plays (530K)" value={f.plays || ""} onChange={(e) => setF({ ...f, plays: e.target.value })} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="volume-plays-input" />
        <input type="number" placeholder="SC track idx" value={f.sc_track ?? ""} onChange={(e) => setF({ ...f, sc_track: e.target.value === "" ? null : parseInt(e.target.value) })} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="volume-sctrack-input" />
      </div>
      <textarea placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm min-h-20" data-testid="volume-desc-input" />
      <input placeholder="Cover URL" value={f.cover_url} onChange={(e) => setF({ ...f, cover_url: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="volume-cover-input" />
      <input placeholder="SoundCloud URL (https://soundcloud.com/...)" value={f.listen_url} onChange={(e) => setF({ ...f, listen_url: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="volume-listen-input" />
      <p className="text-[10px] font-mono tracking-widest text-white/40 -mt-1">Paste a SoundCloud track URL — the widget will play inline on the site.</p>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1" data-testid="volume-save-btn">{t("admin.save")}</button>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">{t("admin.cancel")}</button>
      </div>
    </form>
  );
}

function TourForm({ initial, onSave, onCancel, t }) {
  const [f, setF] = useState(initial || EMPTY_TOUR);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="space-y-3" data-testid="tour-form">
      <div className="grid grid-cols-2 gap-3">
        <input required placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="tour-city-input" />
        <input placeholder="Country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="tour-country-input" />
      </div>
      <input required placeholder="Venue" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="tour-venue-input" />
      <input required type="datetime-local" value={f.date ? f.date.substring(0, 16) : ""} onChange={(e) => setF({ ...f, date: e.target.value + ":00Z" })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="tour-date-input" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Ticket price (cents · empty = external link)</label>
          <input type="number" min="0" placeholder="e.g. 2500 for 25€" value={f.price_cents ?? ""} onChange={(e) => setF({ ...f, price_cents: e.target.value === "" ? null : parseInt(e.target.value) })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm mt-1" data-testid="tour-price-input" />
        </div>
        <div>
          <label className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Currency</label>
          <select value={f.currency || "eur"} onChange={(e) => setF({ ...f, currency: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm mt-1" data-testid="tour-currency-input">
            <option value="eur">EUR</option>
            <option value="usd">USD</option>
            <option value="gbp">GBP</option>
          </select>
        </div>
      </div>
      <input placeholder="External Ticket URL (used if no price set)" value={f.ticket_url} onChange={(e) => setF({ ...f, ticket_url: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="tour-ticket-input" />
      <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="tour-status-input">
        <option value="available">available</option>
        <option value="soldout">soldout</option>
      </select>
      <p className="text-[10px] font-mono tracking-widest text-white/40">
        If price is set, the BILLETS button opens Stripe Checkout (internal ticketing). Otherwise it opens the external URL.
      </p>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1" data-testid="tour-save-btn">{t("admin.save")}</button>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">{t("admin.cancel")}</button>
      </div>
    </form>
  );
}

function ProductForm({ initial, onSave, onCancel, t }) {
  const [f, setF] = useState(initial || EMPTY_PRODUCT);
  const variantsStr = (f.variants || f.sizes || []).join(", ");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="space-y-3" data-testid="product-form">
      <input required placeholder="Product name (Vinyl, Print, Tee, Cap, Ticket…)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="product-name-input" />
      <textarea placeholder="Description" value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm min-h-20" data-testid="product-desc-input" />
      <input placeholder="Image URL" value={f.image_url || ""} onChange={(e) => setF({ ...f, image_url: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="product-image-input" />
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Price (cents)</label>
          <input required type="number" min="100" value={f.price_cents} onChange={(e) => setF({ ...f, price_cents: parseInt(e.target.value) || 0 })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm mt-1" data-testid="product-price-input" />
        </div>
        <div>
          <label className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Currency</label>
          <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm mt-1" data-testid="product-currency-input">
            <option value="eur">EUR</option>
            <option value="usd">USD</option>
            <option value="gbp">GBP</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Order</label>
          <input type="number" value={f.order} onChange={(e) => setF({ ...f, order: parseInt(e.target.value) || 0 })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm mt-1" data-testid="product-order-input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Category (free)</label>
          <input placeholder="Apparel · Vinyl · Print · Ticket…" value={f.category || ""} onChange={(e) => setF({ ...f, category: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm mt-1" data-testid="product-category-input" />
        </div>
        <div>
          <label className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Variant label</label>
          <input placeholder="SIZE · FORMAT · COLOR · EDITION…" value={f.variant_label || ""} onChange={(e) => setF({ ...f, variant_label: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm mt-1" data-testid="product-variantlabel-input" />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Variants (comma separated · leave empty for no selector)</label>
        <input value={variantsStr} onChange={(e) => setF({ ...f, variants: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm mt-1" data-testid="product-variants-input" placeholder='e.g. S, M, L  ·  or  12", 7"  ·  or leave empty' />
      </div>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={!!f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} data-testid="product-active-input" />
        Active (visible on public store)
      </label>
      <p className="text-[10px] font-mono tracking-widest text-white/40">
        On save, product + price are synced to Stripe automatically.
      </p>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1" data-testid="product-save-btn">{t("admin.save")}</button>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">{t("admin.cancel")}</button>
      </div>
    </form>
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState("catalogue");
  const [volumes, setVolumes] = useState([]);
  const [tour, setTour] = useState([]);
  const [subs, setSubs] = useState({ count: 0, items: [] });
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState({ count: 0, items: [] });
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    try {
      const [v, t2, n, m, o] = await Promise.all([
        api.get("/admin/catalogue"),
        api.get("/admin/tour"),
        api.get("/admin/newsletter"),
        api.get("/admin/merch"),
        api.get("/admin/orders"),
      ]);
      setVolumes(v.data);
      setTour(t2.data);
      setSubs(n.data);
      setProducts(m.data);
      setOrders(o.data);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("gm_token");
        navigate("/admin/login");
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (!localStorage.getItem("gm_token")) {
      navigate("/admin/login");
      return;
    }
    load();
  }, [load, navigate]);

  const logout = () => {
    localStorage.removeItem("gm_token");
    localStorage.removeItem("gm_admin");
    navigate("/admin/login");
  };

  const saveVolume = async (data) => {
    try {
      if (data.id) await api.put(`/admin/catalogue/${data.id}`, data);
      else await api.post("/admin/catalogue", data);
      toast.success("Saved");
      setModal(null);
      load();
    } catch { toast.error("Save failed"); }
  };
  const deleteVolume = async (id) => {
    if (!window.confirm(t("admin.confirm"))) return;
    await api.delete(`/admin/catalogue/${id}`);
    toast.success("Deleted");
    load();
  };

  const saveTour = async (data) => {
    try {
      if (data.id) await api.put(`/admin/tour/${data.id}`, data);
      else await api.post("/admin/tour", data);
      toast.success("Saved");
      setModal(null);
      load();
    } catch { toast.error("Save failed"); }
  };
  const deleteTour = async (id) => {
    if (!window.confirm(t("admin.confirm"))) return;
    await api.delete(`/admin/tour/${id}`);
    toast.success("Deleted");
    load();
  };

  const saveProduct = async (data) => {
    try {
      if (data.id) await api.put(`/admin/merch/${data.id}`, data);
      else await api.post("/admin/merch", data);
      toast.success("Saved & synced to Stripe");
      setModal(null);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
  };
  const deleteProduct = async (id) => {
    if (!window.confirm(t("admin.confirm"))) return;
    await api.delete(`/admin/merch/${id}`);
    toast.success("Deleted");
    load();
  };

  const exportCSV = async () => {
    const token = localStorage.getItem("gm_token");
    const res = await fetch(`${API}/admin/newsletter/export`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "newsletter.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const TABS = [
    { key: "catalogue", label: t("admin.catalogue"), icon: Music },
    { key: "tour", label: t("admin.tour"), icon: Calendar },
    { key: "merch", label: "Store", icon: ShoppingBag },
    { key: "orders", label: "Orders", icon: Receipt },
    { key: "newsletter", label: t("admin.newsletter"), icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex" data-testid="admin-dashboard">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 p-6 hidden md:flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-2 h-2 rounded-full bg-[#FF5A1F]" />
          <span className="font-display text-xl tracking-widest">GOOD MOOD</span>
        </div>
        <nav className="flex-1 space-y-1">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                tab === tb.key ? "bg-[#FF5A1F]/10 text-[#FF5A1F]" : "text-white/60 hover:bg-white/5"
              }`}
              data-testid={`admin-tab-${tb.key}`}
            >
              <tb.icon size={16} /> {tb.label}
            </button>
          ))}
        </nav>
        <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-white/60 hover:text-[#FF5A1F]" data-testid="admin-logout-btn">
          <LogOut size={16} /> {t("admin.logout")}
        </button>
      </aside>

      <main className="flex-1 p-8 md:p-12 overflow-x-auto">
        {/* Mobile tabs */}
        <div className="flex gap-2 mb-6 md:hidden">
          {TABS.map((tb) => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              className={`px-3 py-2 text-xs font-mono rounded-full ${tab === tb.key ? "bg-[#FF5A1F] text-black" : "border border-white/10"}`}>
              {tb.label}
            </button>
          ))}
        </div>

        {tab === "catalogue" && (
          <div data-testid="admin-catalogue-tab">
            <div className="flex justify-between items-center mb-6">
              <h1 className="font-display text-4xl">{t("admin.catalogue")}</h1>
              <button className="btn-primary flex items-center gap-2" onClick={() => setModal({ type: "volume", data: EMPTY_VOLUME })} data-testid="add-volume-btn">
                <Plus size={16} /> {t("admin.add")}
              </button>
            </div>
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-black/40 text-xs font-mono tracking-[0.2em] text-white/50">
                  <tr>
                    <th className="text-left px-4 py-3">#</th>
                    <th className="text-left px-4 py-3">TITLE</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">YEAR</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">PLAYS</th>
                    <th className="text-right px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {volumes.map((v) => (
                    <tr key={v.id} className="border-t border-white/5" data-testid={`admin-volume-row-${v.number}`}>
                      <td className="px-4 py-3 font-mono text-[#FF5A1F]">{v.number}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {v.cover_url ? (
                            <img src={v.cover_url} alt="" className="w-10 h-10 rounded object-cover border border-white/10" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center font-mono text-[9px] text-white/30">—</div>
                          )}
                          <span>{v.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-white/50 font-mono text-xs">{v.year || "—"}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-white/50 font-mono text-xs">{v.plays || "—"}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => setModal({ type: "volume", data: v })} className="text-white/60 hover:text-[#FF5A1F]" data-testid={`edit-volume-${v.number}`}><Pencil size={14} /></button>
                        <button onClick={() => deleteVolume(v.id)} className="text-white/60 hover:text-[#C81E3A]" data-testid={`delete-volume-${v.number}`}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "tour" && (
          <div data-testid="admin-tour-tab">
            <div className="flex justify-between items-center mb-6">
              <h1 className="font-display text-4xl">{t("admin.tour")}</h1>
              <button className="btn-primary flex items-center gap-2" onClick={() => setModal({ type: "tour", data: EMPTY_TOUR })} data-testid="add-tour-btn">
                <Plus size={16} /> {t("admin.add")}
              </button>
            </div>
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-black/40 text-xs font-mono tracking-[0.2em] text-white/50">
                  <tr>
                    <th className="text-left px-4 py-3">DATE</th>
                    <th className="text-left px-4 py-3">CITY</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">VENUE</th>
                    <th className="text-left px-4 py-3">STATUS</th>
                    <th className="text-right px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {tour.map((d) => (
                    <tr key={d.id} className="border-t border-white/5" data-testid={`admin-tour-row-${d.id}`}>
                      <td className="px-4 py-3 font-mono text-[#FF5A1F] text-xs">{d.date?.substring(0, 10)}</td>
                      <td className="px-4 py-3">{d.city}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-white/50">{d.venue}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-mono ${d.status === "soldout" ? "text-white/40" : "text-emerald-400"}`}>{d.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => setModal({ type: "tour", data: d })} className="text-white/60 hover:text-[#FF5A1F]" data-testid={`edit-tour-${d.id}`}><Pencil size={14} /></button>
                        <button onClick={() => deleteTour(d.id)} className="text-white/60 hover:text-[#C81E3A]" data-testid={`delete-tour-${d.id}`}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "merch" && (
          <div data-testid="admin-merch-tab">
            <div className="flex justify-between items-center mb-6">
              <h1 className="font-display text-4xl">Store</h1>
              <button className="btn-primary flex items-center gap-2" onClick={() => setModal({ type: "product", data: EMPTY_PRODUCT })} data-testid="add-product-btn">
                <Plus size={16} /> {t("admin.add")}
              </button>
            </div>
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-black/40 text-xs font-mono tracking-[0.2em] text-white/50">
                  <tr>
                    <th className="text-left px-4 py-3">PRODUCT</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">PRICE</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">VARIANTS</th>
                    <th className="text-left px-4 py-3">STATUS</th>
                    <th className="text-right px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 && (
                    <tr><td colSpan="5" className="px-4 py-8 text-center text-white/30 font-mono text-xs">NO PRODUCTS — CLICK ADD</td></tr>
                  )}
                  {products.map((p) => (
                    <tr key={p.id} className="border-t border-white/5" data-testid={`admin-product-row-${p.id}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="w-10 h-10 rounded object-cover border border-white/10" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-white/5 border border-white/10" />
                          )}
                          <div>
                            <div>{p.name}</div>
                            <div className="text-[10px] font-mono text-white/40">{p.lookup_key}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell font-mono text-[#FF5A1F] text-xs">
                        {(p.price_cents / 100).toFixed(0)} {p.currency?.toUpperCase()}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-white/50 font-mono text-xs">{(p.variants || p.sizes || []).join(" · ") || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-mono ${p.active ? "text-emerald-400" : "text-white/40"}`}>
                          {p.active ? "active" : "inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => setModal({ type: "product", data: p })} className="text-white/60 hover:text-[#FF5A1F]" data-testid={`edit-product-${p.id}`}><Pencil size={14} /></button>
                        <button onClick={() => deleteProduct(p.id)} className="text-white/60 hover:text-[#C81E3A]" data-testid={`delete-product-${p.id}`}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div data-testid="admin-orders-tab">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="font-display text-4xl">Orders</h1>
                <p className="text-white/50 font-mono text-xs mt-2 tracking-[0.2em]">{orders.count} TRANSACTIONS</p>
              </div>
            </div>
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-black/40 text-xs font-mono tracking-[0.2em] text-white/50">
                  <tr>
                    <th className="text-left px-4 py-3">DATE</th>
                    <th className="text-left px-4 py-3">PRODUCT</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">SIZE / QTY</th>
                    <th className="text-left px-4 py-3">AMOUNT</th>
                    <th className="text-left px-4 py-3">STATUS</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">EMAIL</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.items.length === 0 && (
                    <tr><td colSpan="6" className="px-4 py-8 text-center text-white/30 font-mono text-xs">NO ORDERS YET</td></tr>
                  )}
                  {orders.items.map((o) => {
                    const prod = products.find((p) => p.lookup_key === o.lookup_key);
                    return (
                    <tr key={o.session_id} className="border-t border-white/5">
                      <td className="px-4 py-3 text-white/50 font-mono text-xs">{o.created_at?.substring(0, 10)}</td>
                      <td className="px-4 py-3">
                        <div>{prod?.name || o.lookup_key}</div>
                        <div className="text-[10px] font-mono text-white/40">{o.lookup_key}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-white/60 font-mono text-xs">{o.size || "—"} · x{o.quantity}</td>
                      <td className="px-4 py-3 font-mono text-[#FF5A1F] text-xs">
                        {((o.amount_cents || 0) / 100).toFixed(2)} {o.currency?.toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-mono ${o.payment_status === "paid" ? "text-emerald-400" : o.payment_status === "failed" ? "text-red-400" : "text-white/40"}`}>
                          {o.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-white/50 text-xs">{o.customer_email || "—"}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "newsletter" && (
          <div data-testid="admin-newsletter-tab">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="font-display text-4xl">{t("admin.newsletter")}</h1>
                <p className="text-white/50 font-mono text-xs mt-2 tracking-[0.2em]">{subs.count} SUBSCRIBERS</p>
              </div>
              <button className="btn-primary flex items-center gap-2" onClick={exportCSV} data-testid="export-csv-btn">
                <Download size={16} /> {t("admin.export")}
              </button>
            </div>
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-black/40 text-xs font-mono tracking-[0.2em] text-white/50">
                  <tr>
                    <th className="text-left px-4 py-3">EMAIL</th>
                    <th className="text-left px-4 py-3">LANG</th>
                    <th className="text-left px-4 py-3">DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.items.length === 0 && (
                    <tr><td colSpan="3" className="px-4 py-8 text-center text-white/30 font-mono text-xs">NO SUBSCRIBERS YET</td></tr>
                  )}
                  {subs.items.map((s) => (
                    <tr key={s.id} className="border-t border-white/5">
                      <td className="px-4 py-3">{s.email}</td>
                      <td className="px-4 py-3 font-mono text-[#FF5A1F] uppercase text-xs">{s.lang}</td>
                      <td className="px-4 py-3 text-white/50 font-mono text-xs">{s.subscribed_at?.substring(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <Modal open={modal?.type === "volume"} onClose={() => setModal(null)} title={modal?.data?.id ? t("admin.edit") : t("admin.add")}>
        {modal?.type === "volume" && <VolumeForm initial={modal.data} onSave={saveVolume} onCancel={() => setModal(null)} t={t} />}
      </Modal>
      <Modal open={modal?.type === "tour"} onClose={() => setModal(null)} title={modal?.data?.id ? t("admin.edit") : t("admin.add")}>
        {modal?.type === "tour" && <TourForm initial={modal.data} onSave={saveTour} onCancel={() => setModal(null)} t={t} />}
      </Modal>
      <Modal open={modal?.type === "product"} onClose={() => setModal(null)} title={modal?.data?.id ? t("admin.edit") : t("admin.add")}>
        {modal?.type === "product" && <ProductForm initial={modal.data} onSave={saveProduct} onCancel={() => setModal(null)} t={t} />}
      </Modal>
    </div>
  );
}
