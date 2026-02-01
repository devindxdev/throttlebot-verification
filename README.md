# 🤖 ThrottleBot Verification

[![License](https://img.shields.io/github/license/devindxdev/throttlebot-verification?style=flat-square)](LICENSE)
[![Issues](https://img.shields.io/github/issues/devindxdev/throttlebot-verification?style=flat-square)](https://github.com/devindxdev/throttlebot-verification/issues)
[![Last Commit](https://img.shields.io/github/last-commit/devindxdev/throttlebot-verification?style=flat-square)](https://github.com/devindxdev/throttlebot-verification/commits/main)
[![Discord](https://img.shields.io/discord/851413403222147073?label=Discord&style=flat-square)](https://discord.gg/Nh4A6HDZT4)
[![Live Stats](https://img.shields.io/endpoint?style=flat-square&url=https%3A%2F%2Fthrottlebot-verify.herokuapp.com%2Fstatus%3Fbadge%3D1)](https://throttlebot-verify.herokuapp.com/status)

> A Discord-first vehicle verification platform with AI-assisted specs, live telemetry, and rich garages for thousands of enthusiasts.

## Highlights
- **Trusted at scale** — serving large communities (AR12Gaming, The Car Community) with global + per-server stats.
- **Garage-first UX** — cards, images, multi-collection views (Daily / Track / Project / Sold), and AI-generated specs.
- **AI assist** — OpenAI-powered spec generation with human review & editing flows.
- **Operations-ready** — live health/status endpoint, structured logging, and QuickChart visual telemetry for `/stats`.
- **Modern Discord** — slash commands, buttons/menus, ephemeral flows; built on discord.js v14.

## Feature Tour
- **Verification flow**: `/verify` with guided decisions, overrides, and smart rejection logic.
- **Garages**: personal collections, per-vehicle images, specs (manual or AI), emoji collection tags, and shareable embeds.
- **Statistics**: approval rates, turnaround time, top/least brands, popular vehicles, AI override stats — all rendered via QuickChart and delivered in embeds.
- **Admin tooling**: `/setup`, `/manage`, `/settings` for images, descriptions, collections, and specs.
- **Status API**: `GET /status` returns live counts (`status`, `updatedAt`, `guilds`, `users`, `verifiedVehicles`, `totalVerifications`) for badges or dashboards.

## Live Status
- Human-readable: [https://throttlebot-verify.herokuapp.com/status](https://throttlebot-verify.herokuapp.com/status)  
- Badge-ready JSON: same endpoint with `?badge=1` (used above).

## Tech Stack
- **Runtime**: Node.js + discord.js v14
- **Data**: MongoDB (Mongoose models for verifications + garages)
- **AI**: OpenAI Chat Completions for spec enrichment
- **Charts**: QuickChart (Chart.js v3) for dynamic embeds
- **Infra**: Heroku dyno (worker) for bot; optional web dyno for status + static site
- **CI/CD**: `heroku-postbuild` builds the Vite marketing site (`throttlebot-site`)

## Local Development
```bash
git clone https://github.com/devindxdev/throttlebot-verification.git
cd throttlebot-verification
npm install
cp .env.example .env   # fill in Discord + Mongo + OpenAI keys
npm run start          # starts the bot (index.js)
```

### Running the marketing site locally
```bash
cd throttlebot-site
npm install
npm run dev            # Vite dev server
```

## Key Commands
- `/verify` — submit a vehicle for approval
- `/garage` — view garages; filter by collections (Daily/Track/Project/Sold)
- `/settings` — manage images, descriptions, specs (manual or AI), collections
- `/stats` — live charts (verifications over time, approval split, AI stats, turnaround, top brands, least popular brands, popular vehicles, top users)

## Deployment Notes (Heroku)
- **Single dyno option**: run `worker` only for the bot; keep `statusServer` enabled inside `index.js` to serve `/status`.
- **Marketing site**: built during `heroku-postbuild` (`cd throttlebot-site && npm install && npm run build`). Serve `throttlebot-site/dist` via the status server or a CDN.
- Ensure environment vars are set: `DISCORD_TOKEN`, `MONGO_URI`, `OPENAI_API_KEY`, `PORT` (for status server).

## Security & License
- Current license: **MIT** (permissive; include notice on reuse).
- No telemetry beyond aggregate counts shown in `/status`.

## Roadmap (shortlist)
- Rich per-collection sharing links
- In-bot moderation dashboard for verifiers
- Optional non-commercial/source-available license variant

## Support
- Join the Discord: https://discord.gg/Nh4A6HDZT4
- Open issues/PRs: https://github.com/devindxdev/throttlebot-verification

---
Crafted for car communities; optimized for reliability, clarity, and fast reviews.
