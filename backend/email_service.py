"""Email service (Resend). No-op when RESEND_API_KEY is empty."""
import os
import asyncio
import logging
from typing import Optional

try:
    import resend
except ImportError:
    resend = None

logger = logging.getLogger(__name__)


def _is_enabled() -> bool:
    return bool(os.environ.get("RESEND_API_KEY")) and resend is not None


def _sender() -> str:
    name = os.environ.get("SENDER_NAME", "Good Mood")
    addr = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    return f"{name} <{addr}>"


async def send_email(to: str, subject: str, html: str) -> Optional[str]:
    """Fire-and-forget style email send. Returns email id or None (skipped/failed)."""
    if not _is_enabled():
        logger.info("email skipped (no RESEND_API_KEY): to=%s subject=%s", to, subject)
        return None
    resend.api_key = os.environ["RESEND_API_KEY"]
    params = {"from": _sender(), "to": [to], "subject": subject, "html": html}
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info("email sent id=%s to=%s", result.get("id"), to)
        return result.get("id")
    except Exception as e:  # noqa: BLE001
        logger.warning("email send failed to=%s err=%s", to, e)
        return None


# --- Templates -----------------------------------------------------------

def _wrap(inner: str) -> str:
    return f"""<!doctype html>
<html><body style="margin:0;background:#050505;color:#fafafa;font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:16px;">
      <tr><td style="padding:32px 40px;border-bottom:1px solid #1f1f1f;">
        <div style="font-family:Impact,'Bebas Neue',sans-serif;font-size:32px;letter-spacing:0.15em;color:#fafafa;">GOOD MOOD</div>
        <div style="font-family:Menlo,monospace;font-size:10px;letter-spacing:0.3em;color:#FF5A1F;margin-top:4px;">DJ SAYD · LIVE &amp; RECORDS</div>
      </td></tr>
      <tr><td style="padding:36px 40px;color:#fafafa;line-height:1.6;font-size:15px;">
        {inner}
      </td></tr>
      <tr><td style="padding:24px 40px;border-top:1px solid #1f1f1f;color:#666;font-size:11px;font-family:Menlo,monospace;letter-spacing:0.2em;">
        GOOD MOOD · CVLN GROUPE · PARIS · CARAÏBES · WORLD
      </td></tr>
    </table>
  </td></tr>
</table></body></html>"""


async def send_newsletter_welcome(to: str, lang: str = "fr") -> Optional[str]:
    copy = {
        "fr": ("Bienvenue dans Good Mood.",
               "Tu es dans la boucle. À partir de maintenant, tu recevras les sorties, dates de tournée et drops exclusifs avant tout le monde.",
               "Reste connecté."),
        "en": ("Welcome to Good Mood.",
               "You're in the loop. From now on, expect releases, tour dates and exclusive drops before anyone else.",
               "Stay tuned."),
        "es": ("Bienvenido a Good Mood.",
               "Ya estás dentro. A partir de ahora, recibirás los lanzamientos, fechas de gira y drops exclusivos antes que nadie.",
               "Sigue conectado."),
        "kr": ("Byenveni nan Good Mood.",
               "Ou nan boukl la. Kounye a, w ap resevwa sòti, dat toune ak drop eksklizif anvan tout moun.",
               "Rete konekte."),
    }
    title, body, sig = copy.get(lang, copy["fr"])
    inner = f"""
      <div style="font-family:Impact,'Bebas Neue',sans-serif;font-size:36px;line-height:1;margin-bottom:16px;">{title}</div>
      <p style="margin:0 0 20px;">{body}</p>
      <p style="margin:0;color:#FF5A1F;font-family:Menlo,monospace;font-size:11px;letter-spacing:0.25em;">— {sig.upper()}</p>
    """
    return await send_email(to=to, subject=f"{title}", html=_wrap(inner))


async def send_order_confirmation(to: str, product_name: str, size: str,
                                  quantity: int, amount_cents: int,
                                  currency: str = "eur") -> Optional[str]:
    symbol = "€" if currency.lower() == "eur" else currency.upper()
    total = f"{(amount_cents or 0) / 100:.2f}{symbol}"
    size_line = f"<tr><td style='padding:6px 0;color:#a3a3a3;'>Size</td><td style='padding:6px 0;text-align:right;'>{size}</td></tr>" if size else ""
    inner = f"""
      <div style="font-family:Impact,'Bebas Neue',sans-serif;font-size:36px;line-height:1;margin-bottom:8px;">MERCI.</div>
      <p style="margin:0 0 24px;color:#a3a3a3;">Your Good Mood order is confirmed. Shipping details will follow.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1f1f1f;border-bottom:1px solid #1f1f1f;font-size:14px;">
        <tr><td style="padding:12px 0;color:#a3a3a3;">Item</td><td style="padding:12px 0;text-align:right;">{product_name}</td></tr>
        {size_line}
        <tr><td style="padding:6px 0;color:#a3a3a3;">Quantity</td><td style="padding:6px 0;text-align:right;">×{quantity}</td></tr>
        <tr><td style="padding:12px 0;color:#a3a3a3;font-weight:700;">Total</td><td style="padding:12px 0;text-align:right;color:#FF5A1F;font-weight:700;">{total}</td></tr>
      </table>
      <p style="margin:24px 0 0;color:#666;font-size:12px;">If you have any question, just reply to this email.</p>
    """
    return await send_email(to=to, subject="Your Good Mood order is confirmed", html=_wrap(inner))



async def send_ticket_confirmation(to: str, event_name: str, event_date: str,
                                    venue: str, city: str, ticket_type: str,
                                    quantity: int, amount_cents: int,
                                    currency: str, first_ticket_url: str,
                                    qr_url: str) -> Optional[str]:
    symbol = "€" if (currency or "eur").lower() == "eur" else currency.upper()
    total = f"{(amount_cents or 0) / 100:.2f}{symbol}"
    date_str = (event_date or "")[:10]
    qr_block = f'<div style="text-align:center;margin:24px 0;"><img src="{qr_url}" alt="QR" width="220" height="220" style="border-radius:12px;background:white;padding:12px;" /></div>' if qr_url else ""
    inner = f"""
      <div style="font-family:Impact,'Bebas Neue',sans-serif;font-size:36px;line-height:1;margin-bottom:8px;">YOU'RE IN.</div>
      <p style="margin:0 0 20px;color:#a3a3a3;">Your ticket for <strong style="color:#fafafa;">{event_name}</strong> is confirmed.</p>
      {qr_block}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1f1f1f;border-bottom:1px solid #1f1f1f;font-size:14px;">
        <tr><td style="padding:12px 0;color:#a3a3a3;">Date</td><td style="padding:12px 0;text-align:right;">{date_str}</td></tr>
        <tr><td style="padding:6px 0;color:#a3a3a3;">Venue</td><td style="padding:6px 0;text-align:right;">{venue}</td></tr>
        <tr><td style="padding:6px 0;color:#a3a3a3;">City</td><td style="padding:6px 0;text-align:right;">{city}</td></tr>
        <tr><td style="padding:6px 0;color:#a3a3a3;">Ticket</td><td style="padding:6px 0;text-align:right;">{ticket_type} × {quantity}</td></tr>
        <tr><td style="padding:12px 0;color:#a3a3a3;font-weight:700;">Total</td><td style="padding:12px 0;text-align:right;color:#FF5A1F;font-weight:700;">{total}</td></tr>
      </table>
      <p style="margin:24px 0 0;text-align:center;">
        <a href="{first_ticket_url}" style="display:inline-block;background:linear-gradient(90deg,#FF5A1F,#C81E3A);color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-family:Impact,sans-serif;letter-spacing:0.12em;">OPEN MY TICKET →</a>
      </p>
      <p style="margin:16px 0 0;color:#666;font-size:12px;">Show this QR at the door. Screenshots welcome.</p>
    """
    return await send_email(to=to, subject=f"Your ticket · {event_name}", html=_wrap(inner))
