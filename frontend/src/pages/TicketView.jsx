import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api";
import { ArrowLeft, MapPin, Calendar } from "lucide-react";

export default function TicketView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/tickets/${id}`).then((r) => setData(r.data)).catch(() => setError("Not found"));
  }, [id]);

  if (error) return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <div className="text-center">
        <p className="font-display text-4xl mb-4">TICKET NOT FOUND</p>
        <Link to="/" className="btn-ghost">HOME</Link>
      </div>
    </div>
  );
  if (!data) return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
      <p className="font-mono text-xs tracking-widest text-white/40">LOADING…</p>
    </div>
  );

  const { ticket, event } = data;
  const isScanned = ticket.status === "scanned";
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 flex items-center justify-center" data-testid="ticket-view-page">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.25em] text-white/50 hover:text-[#FF5A1F] mb-6">
          <ArrowLeft size={14} /> HOME
        </Link>
        <div className="glass rounded-3xl overflow-hidden border border-white/10">
          <div className="p-8 pb-4">
            <p className="font-mono text-[10px] tracking-[0.3em] text-[#FF5A1F] mb-2">— GOOD MOOD LIVE</p>
            <h1 className="font-display text-3xl leading-none">{event.name}</h1>
            <div className="mt-4 space-y-1 text-sm text-white/70">
              <div className="flex items-center gap-2"><Calendar size={14} /> {event.date?.substring(0, 10)}</div>
              <div className="flex items-center gap-2"><MapPin size={14} /> {event.venue} · {event.city}</div>
            </div>
          </div>

          <div className="p-8 flex flex-col items-center">
            <div className={`p-4 rounded-2xl ${isScanned ? "bg-white/5" : "bg-white"} transition-colors`}>
              <img
                src={`${backendUrl}/api/tickets/${id}/qr.png`}
                alt="QR"
                width="260"
                height="260"
                className={isScanned ? "opacity-30" : ""}
                data-testid="ticket-qr-img"
              />
            </div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-white/40 mt-4">{id}</p>
          </div>

          <div className="p-6 border-t border-white/5 flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-widest text-white/40">TYPE</div>
              <div className="font-display text-xl">{ticket.ticket_type_name}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] tracking-widest text-white/40">STATUS</div>
              <div className={`font-mono text-xs tracking-widest ${isScanned ? "text-white/40" : "text-emerald-400"}`}>
                {isScanned ? "USED" : "VALID"}
              </div>
            </div>
          </div>
        </div>
        <p className="text-center font-mono text-[10px] tracking-[0.25em] text-white/30 mt-6">
          SHOW THIS QR AT THE DOOR · SCREENSHOTS WELCOME
        </p>
      </div>
    </div>
  );
}
