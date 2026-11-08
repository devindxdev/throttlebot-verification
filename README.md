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

## Stats counting rules

- Approval and denial charts count final outcomes per application, including explicit AI overrides. Open applications (including pending appeals) and unknown outcomes are excluded. Legacy `denied | reason` records are recognized. Denials include guide rejections, verification bans, and user-left closures; repeated submissions count separately.
- Annual charts group these outcomes by submission year in UTC, with `createdAt` as a fallback. Records without a valid, non-future submission date are excluded from that chart.
- Turnaround shows staff review means for the current UTC month and previous four months, grouped by final decision month. Explicit overrides count as staff decisions. AI decisions are excluded because their saved submission timestamps are written after analysis and do not measure processing time. Invalid, negative, or future durations and user-left closures are excluded; months without samples show gaps.
- AI charts show mutually exclusive current outcomes and explicit overrides. The database does not preserve every original AI decision after appeal processing, so this is not a complete historical AI accuracy measurement.
- Garage rankings count current garage entries, including sold collections. Global counts include entries from multiple servers and may count the same physical vehicle more than once. Vehicle grouping ignores case, spacing, and leading/trailing model years while retaining generation/trim names. Brand charts use an explicit supported manufacturer list and common aliases; unrecognized labels are excluded with counts shown. This list is conservative and may omit obscure manufacturers. Brand approval charts show the ten most-reviewed recognized brands, with at least three decisions each, rather than promoting small samples with 100% approval. Ties are alphabetical.

## Video-only verification

Guild profiles support `videoVerificationRequired` (default `false`). When enabled, `/verify` rejects photos and asks members to upload a short video following the server's existing guide. The requirement is checked again at submission so a confirmation started before a policy change cannot bypass it. Video applications go to staff review; image AI analysis does not run. The checklist and confirmation explain the spoken server name/username and vehicle-start evidence. Video submissions show an upload progress message and a staff-review receipt; oversized-file errors explain how to shorten or compress the video. Cancellation and timeout messages clearly state that the video was not submitted. Existing verified vehicles and pending applications are not retroactively changed.

TCC (`438650836512669699`) has a prepared configuration script. Preview its exact update with `node scripts/configureTccVideoVerification.js --writer`. After explicit approval to write the database, apply it with `node scripts/configureTccVideoVerification.js --apply`. It updates only the existing TCC profile's `videoVerificationRequired` setting and modification timestamp. Deploy the supporting bot code before enabling this setting. After deploying the bot code, preview the TCC-only `/verify` definition with `node scripts/registerTccVerifyCommand.js`, then register it with `--apply` when authorized. This upserts only TCC’s `/verify` command with a `video` attachment option; the handler accepts both the new option and the older `image` option during rollout. Update the live guide’s upload-field label to `video` after registration. Other servers keep their existing command. Both database activation and Discord registration require explicit authorization before applying.

## Verification maintenance

Pending applications older than 30 days are closed at startup and hourly, and before new submissions check for existing pending applications. Closures use the outcome `expired`, excluded from approval/denial rates and staff turnaround. Expired review messages are updated and their buttons disabled when Discord permits access.

Approval, denial, ban and override database effects use MongoDB transactions and conditional status checks. This requires Atlas or a replica set. AI approval requires a boolean requirements check and vehicle match, both true, numeric confidence of 90–100, and a positive numeric estimate below $50,000. Existing AI approvals are not automatically revoked. Denial, appeal, override and closure reasons are persisted; older discarded reasons cannot be recovered from the database.

Garage names use a lowercase key with whitespace collapsed. Maintenance archives every original duplicate record in `garage duplicate archive`, then merges records for the same owner/server/name in a transaction. Images and collections are combined; populated specs and descriptions are retained, preferring the latest edit when values conflict. A unique index prevents new duplicate keys. Startup database commands wait until maintenance succeeds.

Preview with `npm run maintenance:verification`. Apply with `npm run maintenance:verification -- --apply`. The preview uses `MONGO_READONLY_URI` when supplied, otherwise `MONGOURI`. Applying maintenance and the bot runtime use `MONGO_WRITE_URI` when supplied, otherwise `MONGOURI`. Set `MONGO_DB_NAME` to override the database named in the URI; if neither is provided, the database defaults to `throttlebot-verification`. Stop old bot instances before applying maintenance and deploying, so old code cannot bypass the normalized key. MongoDB write and index-creation permissions are required.

Submission ETA uses the latest 50 valid staff decisions, including legacy denials and overrides. AI decisions, expiry, departures and invalid dates are excluded. With fewer than 20 samples it falls back to 24–48 hours.

## Deployment Notes (Heroku)

- Privileged intents are not required: the bot requests only `Guilds` and `GuildMessages`. Leave Server Members, Presence, and Message Content intents disabled in the Developer Portal.
- Without member events, pending applications are not closed immediately when someone leaves. Normal and override approvals fetch the individual applicant's current membership before saving approval or creating a garage entry; departed applicants' requests are closed at review time. Membership lookup failures leave the request unchanged for retry.
- Automatic supporter tier synchronization from role-change events is paused. Existing saved premium profiles continue to work. The member event handlers are retained but are not registered while member access is disabled.
- Deploy this version and restart the bot to stop requesting the revoked intent. The runtime uses `TOKEN` for the Discord token and `MONGOURI` for the database connection; keep these in your hosting provider's environment settings.
- **Single dyno option**: run `worker` only for the bot; keep `statusServer` enabled inside `index.js` to serve `/status`.
- **Marketing site**: built during `heroku-postbuild` (`cd throttlebot-site && npm install && npm run build`). Serve `throttlebot-site/dist` via the status server or a CDN.
- Ensure environment vars are set: `TOKEN`, `MONGOURI`, `OPENAI_API_KEY`, `PORT` (for status server).

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
