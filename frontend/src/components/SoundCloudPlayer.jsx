import React, { useEffect, useRef, useState } from "react";
import { X, Play, Pause, ExternalLink } from "lucide-react";

// Load the SoundCloud widget API script once
let scriptPromise = null;
function loadSoundCloudApi() {
  if (window.SC && window.SC.Widget) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://w.soundcloud.com/player/api.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load SoundCloud widget"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function buildEmbedUrl(trackUrl) {
  const params = new URLSearchParams({
    url: trackUrl,
    color: "#ff5a1f",
    auto_play: "true",
    hide_related: "true",
    show_comments: "false",
    show_user: "true",
    show_reposts: "false",
    show_teaser: "false",
    visual: "true",
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

export default function SoundCloudPlayer({ open, onClose, trackUrl, title, volumeNumber }) {
  const iframeRef = useRef(null);
  const widgetRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (!open || !trackUrl) return;
    let cancelled = false;

    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);

    loadSoundCloudApi().then(() => {
      if (cancelled || !iframeRef.current) return;
      const w = window.SC.Widget(iframeRef.current);
      widgetRef.current = w;

      w.bind(window.SC.Widget.Events.READY, () => {
        setReady(true);
        w.getDuration((d) => setDuration(d));
      });
      w.bind(window.SC.Widget.Events.PLAY, () => setPlaying(true));
      w.bind(window.SC.Widget.Events.PAUSE, () => setPlaying(false));
      w.bind(window.SC.Widget.Events.FINISH, () => setPlaying(false));
      w.bind(window.SC.Widget.Events.PLAY_PROGRESS, (data) => {
        setPosition(data.currentPosition);
      });
    });

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      if (widgetRef.current) {
        try {
          widgetRef.current.pause();
          widgetRef.current.unbind(window.SC.Widget.Events.PLAY);
          widgetRef.current.unbind(window.SC.Widget.Events.PAUSE);
          widgetRef.current.unbind(window.SC.Widget.Events.FINISH);
          widgetRef.current.unbind(window.SC.Widget.Events.PLAY_PROGRESS);
          widgetRef.current.unbind(window.SC.Widget.Events.READY);
        } catch (e) { /* ignore */ }
      }
      setReady(false);
      setPlaying(false);
      setPosition(0);
      setDuration(0);
    };
  }, [open, trackUrl]);

  const toggle = () => {
    if (!widgetRef.current) return;
    widgetRef.current.toggle();
  };

  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
      data-testid="sc-player-modal"
    >
      <div
        className="w-full max-w-3xl glass rounded-3xl overflow-hidden border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-[#FF5A1F] mb-1">
              VOL. {volumeNumber} — NOW PLAYING
            </p>
            <h3 className="font-display text-3xl">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-white/10 hover:border-[#FF5A1F] flex items-center justify-center transition-colors"
            data-testid="sc-player-close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Custom orange overlay controls */}
        {ready && duration > 0 && (
          <div className="px-6 pt-5 pb-3 flex items-center gap-4">
            <button
              onClick={toggle}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF5A1F] to-[#C81E3A] flex items-center justify-center shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:scale-105 transition-transform"
              data-testid="sc-player-toggle"
            >
              {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>
            <div className="flex-1">
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FF5A1F] to-[#C81E3A] transition-[width] duration-150"
                  style={{ width: `${duration ? (position / duration) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 font-mono text-[10px] tracking-widest text-white/50">
                <span>{fmt(position)}</span>
                <span>{fmt(duration)}</span>
              </div>
            </div>
          </div>
        )}

        {/* SoundCloud iframe */}
        <div className="relative bg-black">
          <iframe
            ref={iframeRef}
            title={`SoundCloud player — ${title}`}
            width="100%"
            height="380"
            scrolling="no"
            frameBorder="no"
            allow="autoplay"
            src={buildEmbedUrl(trackUrl)}
            className="block"
            data-testid="sc-player-iframe"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-[0.25em] text-white/40">
            POWERED BY SOUNDCLOUD
          </p>
          <a
            href={trackUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-white/60 hover:text-[#FF5A1F] transition-colors"
            data-testid="sc-player-external"
          >
            OPEN IN SOUNDCLOUD <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  );
}
