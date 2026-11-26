# sdass-globalquizevents

Static TikTok pay funnel.

- `/` redirects to the English funnel at `/en/inicio/`
- English (USD): `/en/inicio/` → quiz → withdraw → registration → `/en/up1/` → `/en/up2/` → `/en/up3/` → `/en/thankyou/` / `/en/refund/`
- Mexico (español, MXN): `/mx/inicio/` with the same steps under `/mx/`
- Legacy paths (`/inicio/`, `/up1/`, `/thankyou/`, `/refund/`) redirect to the English funnel

MXN amounts use the Banco de México FIX rate of 19.72 pesos per dollar (26 Nov 2026). The Vendepay checkout and upsell product IDs are unchanged.

Connect this repository to the Vercel project `globalquizevents` (root directory = repo root).
