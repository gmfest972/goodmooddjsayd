import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/api";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, Check, X, AlertTriangle, Loader2, RefreshCw } from "lucide-react";

export default function StaffScan() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [lastResult, setLastResult] = useState(null); // { result, ticket, ts }
  const [scanning, setScanning] = useState(false);
  const [counter, setCounter] = useState(null);
  const scannerRef = useRef(null);
  const lockRef = useRef(false);

  useEffect(() => {
    if (!localStorage.getItem("gm_token")) { navigate("/admin/login"); return; }
    api.get("/admin/events").then((r) => {
      const upcoming = r.data.filter((e) => e.status === "on_sale" || e.status === "announced" || e.status === "sold_out");
      setEvents(upcoming);
      if (upcoming.length > 0) setSelectedEvent(upcoming[0].id);
    }).catch((err) => {
      if (err.response?.status === 401) navigate("/admin/login");
    });
  }, [navigate]);

  const refreshCounter = async () => {
    if (!selectedEvent) return;
    try {
      const { data } = await api.get(`/scan/counter/${selectedEvent}`);
      setCounter(data);
    } catch {}
  };
  useEffect(() => { refreshCounter(); }, [selectedEvent]); // eslint-disable-line

  const startScanner = async () => {
    if (!selectedEvent || scanning) return;
    setScanning(true);
    try {
      const html5Qr = new Html5Qrcode("qr-region");
      scannerRef.current = html5Qr;
      await html5Qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decoded) => {
          if (lockRef.current) return;
          lockRef.current = true;
          try {
            const { data } = await api.post("/scan/check", { ticket_id: decoded, event_id: selectedEvent });
            setLastResult({ ...data, ts: Date.now() });
            refreshCounter();
          } catch (err) {
            setLastResult({ result: "invalid", reason: err.response?.data?.detail || "Error", ts: Date.now() });
          }
          setTimeout(() => { lockRef.current = false; }, 1500);
        },
        () => {}
      );
    } catch (err) {
      setScanning(false);
      alert("Camera error: " + err);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      try { await scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => () => { stopScanner(); }, []); // eslint-disable-line

  const resultColor = lastResult?.result === "valid" ? "emerald"
    : lastResult?.result === "already_scanned" ? "yellow" : "red";

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-6" data-testid="staff-scan-page">
      <div className="max-w-md mx-auto">
        <Link to="/admin" className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.25em] text-white/50 hover:text-[#FF5A1F] mb-4">
          <ArrowLeft size={14} /> ADMIN
        </Link>

        <div className="glass rounded-2xl p-6 mb-4">
          <p className="font-mono text-[10px] tracking-[0.3em] text-[#FF5A1F] mb-3">— DOOR CONTROL</p>
          <h1 className="font-display text-3xl mb-6 leading-none">SCAN</h1>

          <label className="text-[10px] font-mono tracking-widest text-white/50 uppercase">EVENT</label>
          <select value={selectedEvent} onChange={(e) => { stopScanner(); setSelectedEvent(e.target.value); setLastResult(null); }}
            className="w-full mt-2 bg-black border border-white/10 rounded-lg px-3 py-3 text-sm"
            data-testid="scan-event-select">
            {events.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.city}</option>)}
          </select>

          {counter && (
            <div className="mt-4 flex items-center justify-between p-4 bg-black/40 rounded-lg">
              <div>
                <div className="font-mono text-[10px] tracking-widest text-white/40">CHECKED-IN</div>
                <div className="font-display text-3xl">{counter.scanned}<span className="text-white/30 text-xl"> / {counter.issued}</span></div>
              </div>
              <button onClick={refreshCounter} className="text-white/50 hover:text-[#FF5A1F]" data-testid="scan-refresh-counter">
                <RefreshCw size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6 mb-4">
          <div id="qr-region" className="w-full aspect-square rounded-xl overflow-hidden bg-black relative">
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center text-white/30 font-mono text-xs tracking-widest">
                CAMERA IDLE
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            {!scanning ? (
              <button onClick={startScanner} className="btn-primary flex-1" data-testid="scan-start-btn">START SCANNING</button>
            ) : (
              <button onClick={stopScanner} className="btn-ghost flex-1" data-testid="scan-stop-btn">STOP</button>
            )}
          </div>
        </div>

        {lastResult && (
          <div className={`glass rounded-2xl p-6 border-2 ${
            resultColor === "emerald" ? "border-emerald-500/50" :
            resultColor === "yellow" ? "border-yellow-500/50" : "border-red-500/50"
          }`} data-testid="scan-result">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                resultColor === "emerald" ? "bg-emerald-500/20 text-emerald-400" :
                resultColor === "yellow" ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"
              }`}>
                {lastResult.result === "valid" ? <Check size={28} /> :
                 lastResult.result === "already_scanned" ? <AlertTriangle size={28} /> : <X size={28} />}
              </div>
              <div>
                <div className="font-display text-2xl leading-none">
                  {lastResult.result === "valid" ? "VALID" :
                   lastResult.result === "already_scanned" ? "ALREADY IN" : "INVALID"}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {lastResult.ticket?.ticket_type_name || lastResult.reason || "—"}
                </div>
                {lastResult.ticket?.buyer_email && (
                  <div className="text-xs text-white/40 font-mono mt-1">{lastResult.ticket.buyer_email}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
