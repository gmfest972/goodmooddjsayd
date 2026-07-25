import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { API } from "@/api";
import { toast } from "sonner";
import { LogOut, Plus, Pencil, Trash2, Download, Music, Calendar, Mail, ShoppingBag, Receipt, Users, ScanLine, Ticket } from "lucide-react";

const EMPTY_VOLUME = { number: "", title: "", year: "", plays: "", description: "", cover_url: "", listen_url: "", sc_track: null, order: 0 };
const EMPTY_EVENT = { name: "", city: "", country: "", venue: "", date: "", currency: "eur", capacity: 0, status: "vision", ticket_url: "" };
const EMPTY_TT = { name: "", price_cents: 2500, quota: 100, sale_start: "", sale_end: "" };
const EMPTY_PRODUCT = { name: "", description: "", image_url: "", price_cents: 3500, currency: "eur", category: "", variant_label: "", variants: [], active: true, order: 0 };
const EVENT_STATUSES = ["vision", "announced", "on_sale", "sold_out", "past"];

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

function EventForm({ initial, onSave, onCancel, t }) {
  const [f, setF] = useState(initial || EMPTY_EVENT);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="space-y-3" data-testid="event-form">
      <input required placeholder="Event name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="event-name-input" />
      <div className="grid grid-cols-2 gap-3">
        <input required placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="event-city-input" />
        <input placeholder="Country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" />
      </div>
      <input required placeholder="Venue" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="event-venue-input" />
      <input required type="datetime-local" value={f.date ? f.date.substring(0, 16) : ""} onChange={(e) => setF({ ...f, date: e.target.value + ":00Z" })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="event-date-input" />
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Capacity (jauge)</label>
          <input type="number" min="0" value={f.capacity} onChange={(e) => setF({ ...f, capacity: parseInt(e.target.value) || 0 })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm mt-1" data-testid="event-capacity-input" />
        </div>
        <div>
          <label className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Currency</label>
          <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm mt-1">
            <option value="eur">EUR</option><option value="usd">USD</option><option value="gbp">GBP</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Status</label>
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm mt-1" data-testid="event-status-input">
            {EVENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <input placeholder="External Ticket URL (optional fallback)" value={f.ticket_url || ""} onChange={(e) => setF({ ...f, ticket_url: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" />
      <p className="text-[10px] font-mono tracking-widest text-white/40">
        Vision = internal only · Announced = visible, "SOON" · On sale = ticket sale active · Sold out = closed · Past = archived
      </p>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1" data-testid="event-save-btn">{t("admin.save")}</button>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">{t("admin.cancel")}</button>
      </div>
    </form>
  );
}

function TicketTypeForm({ initial, eventId, onSave, onCancel, t }) {
  const [f, setF] = useState(initial || EMPTY_TT);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...f, event_id: eventId }); }} className="space-y-3" data-testid="tt-form">
      <input required placeholder="Name (Standard, VIP, Early Bird…)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" data-testid="tt-name-input" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Price (cents)</label>
          <input required type="number" min="0" value={f.price_cents} onChange={(e) => setF({ ...f, price_cents: parseInt(e.target.value) || 0 })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm mt-1" data-testid="tt-price-input" />
        </div>
        <div>
          <label className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Quota</label>
          <input required type="number" min="1" value={f.quota} onChange={(e) => setF({ ...f, quota: parseInt(e.target.value) || 0 })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm mt-1" data-testid="tt-quota-input" />
        </div>
      </div>
      <p className="text-[10px] font-mono tracking-widest text-white/40">Synced to Stripe on save.</p>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1" data-testid="tt-save-btn">{t("admin.save")}</button>
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
  const [events, setEvents] = useState([]);
  const [fans, setFans] = useState({ count: 0, items: [] });
  const [subs, setSubs] = useState({ count: 0, items: [] });
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState({ count: 0, items: [] });
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    try {
      const [v, e, f, n, m, o] = await Promise.all([
        api.get("/admin/catalogue"),
        api.get("/admin/events"),
        api.get("/admin/fans"),
        api.get("/admin/newsletter"),
        api.get("/admin/merch"),
        api.get("/admin/orders"),
      ]);
      setVolumes(v.data);
      setEvents(e.data);
      setFans(f.data);
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

  const saveTour = async () => {}; // deprecated — kept only to avoid ref errors in tour tab modal (removed)
  const deleteTour = async () => {};

  const saveVolume = async (data) => {
    try {
      if (data.id) await api.put(`/admin/catalogue/${data.id}`, data);
      else await api.post("/admin/catalogue", data);
      toast.success("Saved");
      setModal(null); load();
    } catch { toast.error("Save failed"); }
  };
  const deleteVolume = async (id) => {
    if (!window.confirm(t("admin.confirm"))) return;
    await api.delete(`/admin/catalogue/${id}`);
    toast.success("Deleted"); load();
  };

  const saveEvent = async (data) => {
    try {
      if (data.id) await api.put(`/admin/events/${data.id}`, data);
      else await api.post("/admin/events", data);
      toast.success("Saved");
      setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
  };
  const deleteEvent = async (id) => {
    if (!window.confirm(t("admin.confirm"))) return;
    await api.delete(`/admin/events/${id}`);
    toast.success("Deleted"); load();
  };
  const saveTicketType = async (data) => {
    try {
      if (data.id) await api.put(`/admin/events/${data.event_id}/ticket-types/${data.id}`, data);
      else await api.post(`/admin/events/${data.event_id}/ticket-types`, data);
      toast.success("Saved & synced to Stripe");
      setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
  };
  const deleteTicketType = async (eventId, id) => {
    if (!window.confirm(t("admin.confirm"))) return;
    await api.delete(`/admin/events/${eventId}/ticket-types/${id}`);
    toast.success("Deleted"); load();
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
    { key: "events", label: "Events", icon: Calendar },
    { key: "fans", label: "Fans", icon: Users },
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

        {tab === "events" && (
          <div data-testid="admin-events-tab">
            <div className="flex justify-between items-center mb-6">
              <h1 className="font-display text-4xl">Events</h1>
              <div className="flex gap-3">
                <a href="/scan" target="_blank" rel="noreferrer" className="btn-ghost inline-flex items-center gap-2" data-testid="scan-link">
                  <ScanLine size={16} /> DOOR SCAN
                </a>
                <button className="btn-primary flex items-center gap-2" onClick={() => setModal({ type: "event", data: EMPTY_EVENT })} data-testid="add-event-btn">
                  <Plus size={16} /> Add Event
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {events.length === 0 && <div className="glass rounded-2xl p-10 text-center text-white/40 font-mono text-xs">NO EVENTS</div>}
              {events.map((ev) => {
                const fill = ev.total_quota > 0 ? Math.round(100 * ev.total_sold / ev.total_quota) : 0;
                return (
                <div key={ev.id} className="glass rounded-2xl overflow-hidden" data-testid={`admin-event-${ev.id}`}>
                  <div className="p-5 flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`inline-block text-[10px] font-mono tracking-widest px-2 py-1 rounded-full ${
                          ev.status === "on_sale" ? "bg-emerald-500/20 text-emerald-400" :
                          ev.status === "sold_out" ? "bg-yellow-500/20 text-yellow-400" :
                          ev.status === "past" ? "bg-white/10 text-white/40" :
                          ev.status === "announced" ? "bg-[#FF5A1F]/20 text-[#FF5A1F]" :
                          "bg-white/5 text-white/40"
                        }`}>{ev.status.toUpperCase()}</span>
                        <span className="font-mono text-[10px] text-white/50 tracking-widest">{ev.date?.substring(0, 10)}</span>
                      </div>
                      <h3 className="font-display text-2xl mt-1">{ev.name}</h3>
                      <p className="text-xs text-white/50 mt-1">{ev.venue} · {ev.city}{ev.country ? ` — ${ev.country}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[10px] text-white/40 tracking-widest">SOLD / CAPACITY</div>
                      <div className="font-display text-2xl">{ev.total_sold || 0}<span className="text-white/30 text-base"> / {ev.capacity || ev.total_quota}</span></div>
                      <div className="font-mono text-[10px] text-[#FF5A1F] tracking-widest">
                        {((ev.total_revenue_cents || 0) / 100).toFixed(0)} {ev.currency?.toUpperCase()} · {fill}% FILL
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => setModal({ type: "event", data: ev })} className="text-white/60 hover:text-[#FF5A1F]" data-testid={`edit-event-${ev.id}`}><Pencil size={14} /></button>
                      <button onClick={() => deleteEvent(ev.id)} className="text-white/60 hover:text-[#C81E3A]" data-testid={`delete-event-${ev.id}`}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="border-t border-white/5 bg-black/30 px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-mono text-[10px] tracking-widest text-white/50">TICKET TYPES</p>
                      <button onClick={() => setModal({ type: "tt", data: { ...EMPTY_TT, event_id: ev.id }, eventId: ev.id })} className="text-xs font-mono text-[#FF5A1F] hover:text-white flex items-center gap-1" data-testid={`add-tt-${ev.id}`}>
                        <Plus size={12} /> ADD
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(ev.ticket_types || []).length === 0 && (
                        <p className="text-xs text-white/30 font-mono">No ticket types yet — add one to open sales.</p>
                      )}
                      {(ev.ticket_types || []).map((tt) => (
                        <div key={tt.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-3">
                            <Ticket size={14} className="text-[#FF5A1F]" />
                            <span>{tt.name}</span>
                            <span className="font-mono text-[10px] text-white/40">{tt.sold}/{tt.quota} · {(tt.price_cents / 100).toFixed(0)}{ev.currency?.toLowerCase() === "eur" ? "€" : ev.currency?.toUpperCase()}</span>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setModal({ type: "tt", data: tt, eventId: ev.id })} className="text-white/50 hover:text-[#FF5A1F]" data-testid={`edit-tt-${tt.id}`}><Pencil size={12} /></button>
                            <button onClick={() => deleteTicketType(ev.id, tt.id)} className="text-white/50 hover:text-[#C81E3A]"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "fans" && (
          <div data-testid="admin-fans-tab">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="font-display text-4xl">Fans</h1>
                <p className="text-white/50 font-mono text-xs mt-2 tracking-[0.2em]">{fans.count} FANS · CRM</p>
              </div>
            </div>
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-black/40 text-xs font-mono tracking-[0.2em] text-white/50">
                  <tr>
                    <th className="text-left px-4 py-3">EMAIL</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">NAME</th>
                    <th className="text-left px-4 py-3">EVENTS</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">CITIES</th>
                    <th className="text-left px-4 py-3">SEGMENTS</th>
                  </tr>
                </thead>
                <tbody>
                  {fans.items.length === 0 && (
                    <tr><td colSpan="5" className="px-4 py-8 text-center text-white/30 font-mono text-xs">NO FANS YET — SELL A TICKET</td></tr>
                  )}
                  {fans.items.map((f) => (
                    <tr key={f.email} className="border-t border-white/5" data-testid={`fan-row-${f.email}`}>
                      <td className="px-4 py-3">{f.email}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-white/70">{f.name || "—"}</td>
                      <td className="px-4 py-3 font-mono text-[#FF5A1F]">{f.total_events}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-white/50 text-xs">{(f.cities || []).join(", ")}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {(f.segments || []).map((s) => (
                            <span key={s} className={`text-[9px] font-mono tracking-widest px-2 py-0.5 rounded-full ${
                              s === "vip" ? "bg-[#FF5A1F]/20 text-[#FF5A1F]" :
                              s === "recurring" ? "bg-emerald-500/20 text-emerald-400" :
                              "bg-white/10 text-white/60"
                            }`}>{s.toUpperCase()}</span>
                          ))}
                        </div>
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
      <Modal open={modal?.type === "event"} onClose={() => setModal(null)} title={modal?.data?.id ? "Edit event" : "Add event"}>
        {modal?.type === "event" && <EventForm initial={modal.data} onSave={saveEvent} onCancel={() => setModal(null)} t={t} />}
      </Modal>
      <Modal open={modal?.type === "tt"} onClose={() => setModal(null)} title={modal?.data?.id ? "Edit ticket type" : "Add ticket type"}>
        {modal?.type === "tt" && <TicketTypeForm initial={modal.data} eventId={modal.eventId} onSave={saveTicketType} onCancel={() => setModal(null)} t={t} />}
      </Modal>
      <Modal open={modal?.type === "product"} onClose={() => setModal(null)} title={modal?.data?.id ? t("admin.edit") : t("admin.add")}>
        {modal?.type === "product" && <ProductForm initial={modal.data} onSave={saveProduct} onCancel={() => setModal(null)} t={t} />}
      </Modal>
    </div>
  );
}
