# sdass-globalquizevents

Static TikTok pay funnel.

- `/` redirects to the English funnel at `/en/inicio/`
- English (USD): `/en/inicio/` → quiz → withdraw → registration → `/en/up1/` → `/en/up2/` → `/en/up3/` → `/en/thankyou/` / `/en/refund/`
- Mexico (español, MXN): `/mx/inicio/` with the same steps under `/mx/`
- Legacy paths (`/inicio/`, `/up1/`, `/thankyou/`, `/refund/`) redirect to the English funnel

MX funnel balance is $9.870,20 MXN. Fees: front $197,00 MXN, up1 $297,00 MXN, up2 $349,00 MXN, up3 $497,00 MXN. MX upsells use xpag.global checkout buttons (not Vendepay one-click).
Connect this repository to the Vercel project `globalquizevents` (root directory = repo root).
