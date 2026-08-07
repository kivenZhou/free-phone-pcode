# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` branch | ✅ |

## Reporting a Vulnerability

If you discover a security issue in **this project's code** (not third-party SMS content), please open a [GitHub Security Advisory](https://github.com/kivenZhou/free-phone-pcode/security/advisories/new) or a private issue if Advisories are unavailable.

Do **not** publicly disclose issues that could help abuse live deployments before a fix is available.

## Known Deployment Risks

These are architectural notes for operators, not necessarily bugs:

### 1. Unauthenticated refresh API

`POST /api/refresh` triggers full multi-source scraping and can be CPU/network intensive. Public deployments should:

- Set `REFRESH_TOKEN` and pass `Authorization: Bearer <token>` on refresh requests; or
- Block `/api/refresh` at the reverse proxy except for admin IPs; or
- Rate-limit POST requests.

### 2. Cached SMS in `data/store.json`

The local JSON cache may contain OTPs and message bodies from public inboxes. Ensure:

- `/data/` is not web-accessible;
- Backups are encrypted or excluded;
- Never commit `data/store.json` to git.

### 3. Client-side favorites

Favorites are stored in browser `localStorage` only — no server-side account system. This is intentional and low risk.

### 4. Third-party scraping

Scraping upstream sites is not a vulnerability in this repo, but misconfiguration (aggressive concurrency, ignoring blocks) can harm your infrastructure or trigger upstream bans.

## Recommended Production Checklist

- [ ] Set `REFRESH_TOKEN` if the instance is public
- [ ] Keep `DISABLED_PROVIDERS` updated for blocked/unauthorized sources
- [ ] Run behind HTTPS
- [ ] Monitor disk usage for `data/store.json` growth
- [ ] Read [DISCLAIMER.md](./DISCLAIMER.md) before going live
