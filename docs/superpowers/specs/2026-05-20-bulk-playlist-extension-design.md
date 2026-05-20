# Bulk Playlist Extension — Design

**Status:** Draft for review
**Date:** 2026-05-20
**Author:** Cheng Hao Li (with brainstorming assistance)

## 1. Summary

A Chrome extension that, while the user is on a YouTube channel or video page, lets them add **the latest N**, **the oldest N**, or **the most popular N** videos from that channel to one of their YouTube playlists. Supports up to **1000 videos** per run, deduplicates against the existing playlist contents, and reports live progress.

## 2. Goals & non-goals

### Goals

- Trigger from a browser-action popup on `youtube.com` pages.
- Select videos from a channel by Latest / Oldest / Most Popular, with a user-supplied count up to 1000.
- Add to an existing YouTube playlist or create a new one.
- Skip videos already present in the target playlist.
- Show live progress and a final summary (added / skipped / failed).
- Survive long runs (1000-video adds may take minutes) as long as the YouTube tab stays open.

### Non-goals (v1)

- A YouTube Data API path. We use YouTube's internal Innertube endpoints from inside the page session.
- Operations that run when no YouTube tab is open. (We're using a content-script-only architecture; without a YouTube tab, the extension is idle.)
- Anything more than "skip duplicates" for conflict handling (no reordering, replacing, removing).
- Min-view-count filter and other content filters. (Possible v2 — design accommodates them but they're not built.)
- Multi-channel batch jobs.

## 3. User-facing flow

1. User is on `youtube.com/@SomeChannel` (or a video page where channel can be derived).
2. User clicks the extension icon. The popup opens.
3. Popup asks the content script for context: channel ID, channel name, and the user's playlists.
4. Popup renders:
   - Channel name banner (confirmation).
   - Mode picker: **Latest / Oldest / Popular**.
   - Count input (1–1000, validated).
   - Playlist dropdown: existing playlists + a "Create new playlist…" option.
   - "Add" button.
5. User picks mode, count, and target; clicks Add.
6. Content script fetches the channel's videos in the chosen order, fetches the target playlist's existing IDs, filters duplicates, then adds the remainder in batches with a short inter-batch delay.
7. Popup receives `PROGRESS` messages and updates a progress display.
8. On completion, content script sends `ADD_DONE`. Popup shows summary: added / skipped / failed.

### Edge case: Oldest N on large channels

YouTube's internal API paginates newest-first. To collect the *oldest* N, the content script must walk the entire channel uploads list before slicing the last N. For a 5000-video channel this could take 30+ seconds. The UI shows an indeterminate "Collecting videos…" state during this phase.

### Failure semantics

Partial progress is preserved. If the run fails at video 400 of 1000, the first 400 are kept in the playlist. The summary reports the failure point. Re-running the same operation will skip those 400 thanks to dedupe, so the user can recover by clicking Add again.

## 4. Architecture

### 4.1 Why content-script-only

The Chrome extension has three possible execution contexts (popup, content script, service worker). Two design constraints drive the architecture:

- **Authentication.** YouTube's internal endpoints require the page's `ytcfg` (Innertube API key + session tokens) and a logged-in cookie. The content script runs same-origin with `youtube.com`, so both are available with zero auth setup. A service worker would require manual `SAPISIDHASH` computation from cookies — significant boilerplate that teaches little.
- **Simplicity.** Two execution contexts (popup + content script) are easier to reason about than three. MV3 service worker lifecycle (Chrome terminates idle workers without warning) adds debugging friction that's not worth it for a learning project.

The trade-off: long runs require the YouTube tab to stay open. The UI communicates this explicitly. For runs in the 1000-video range, this is acceptable.

### 4.2 Components

```
┌────────────────────────────────────────────────────────────────────────┐
│                       Chrome — YouTube tab open                        │
│                                                                        │
│   ┌──────────────────┐                ┌─────────────────────────────┐  │
│   │  Popup (React)   │   messages     │  Content script             │  │
│   │                  │ ─────────────▶ │  (runs inside youtube.com)  │  │
│   │  - mode picker   │ ◀───────────── │                             │  │
│   │  - count input   │   responses    │  - listens for messages     │  │
│   │  - playlist drop │   + PROGRESS   │  - dispatches to lib/youtube│  │
│   │  - add button    │                │  - streams PROGRESS back    │  │
│   │  - summary       │                │                             │  │
│   └──────────────────┘                └─────────────────────────────┘  │
│           │                                       │                    │
│           │ imports                               │ imports            │
│           ▼                                       ▼                    │
│   ┌──────────────────┐                ┌─────────────────────────────┐  │
│   │ lib/messaging.ts │                │ lib/youtube/* (channel,     │  │
│   │ lib/types.ts     │ ◀ also imports │ playlists, video getter,    │  │
│   │ (typed wrappers) │                │ video adder, dedupe, …)     │  │
│   └──────────────────┘                └─────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.3 File layout

```
playlist_editor_extension/
├── manifest.json
├── package.json
├── vite.config.ts
├── tsconfig.json
│
├── src/
│   ├── popup/                        — Popup entry, React UI
│   │   ├── index.html                Mounts a single root div for React
│   │   ├── main.tsx                  React entry, renders <App/>
│   │   ├── App.tsx                   Top-level popup: state + message dispatch
│   │   ├── global.css                Shared popup styles
│   │   └── components/
│   │       ├── ModePicker.tsx        Latest / Oldest / Popular buttons
│   │       ├── CountInput.tsx        Numeric input, validated 1–1000
│   │       ├── PlaylistPicker.tsx    Dropdown of playlists + "Create new"
│   │       ├── AddButton.tsx         Add button + progress spinner
│   │       └── Summary.tsx           Added / skipped / failed display
│   │
│   ├── content/                      — Content script entry
│   │   └── content.ts                The ONLY listener for chrome.runtime
│   │                                 messages. Dispatches to lib/youtube/*.
│   │
│   └── lib/
│       ├── messaging.ts              Typed wrappers around chrome.runtime
│       │                             .sendMessage. Imported by BOTH popup
│       │                             and content. Does NOT listen.
│       ├── types.ts                  All shared data shapes: Playlist,
│       │                             Video, Mode, Message union, etc.
│       └── youtube/                  YouTube knowledge. ONLY content.ts
│           │                         imports from here.
│           ├── innertube.ts          Reads page's ytcfg + low-level
│           │                         POST helper to /youtubei/v1/*.
│           ├── channel.ts            Resolves channel ID + name from
│           │                         current URL/DOM.
│           ├── playlists.ts          Fetches user's playlists; creates
│           │                         new playlists.
│           ├── videoFetcher.ts       Fetches N videos by mode (latest /
│           │                         oldest / popular). Handles pagination.
│           ├── videoAdder.ts         Adds a batch of video IDs to a
│           │                         playlist via edit_playlist endpoint.
│           └── dedupe.ts             Pure function: given fetched videos
│                                     and existing playlist IDs, returns
│                                     videos to add. No I/O.
│
└── tests/
    ├── dedupe.test.ts                Pure: trivial to unit-test.
    ├── messaging.test.ts             Type-level + small handler tests.
    └── videoFetcher.test.ts          Pagination/slicing logic with
                                       mocked innertube responses.
```

### 4.4 Module responsibilities

**Popup side (none of these touch YouTube directly.)**

- `App.tsx` — owns the popup's state (channel context, playlist list, mode, count, target playlist, progress, summary). On mount, sends `GET_CHANNEL` and `GET_PLAYLISTS`. On Add click, sends `ADD_VIDEOS`. Subscribes to `PROGRESS` and `ADD_DONE`.
- `ModePicker`, `CountInput`, `PlaylistPicker`, `AddButton`, `Summary` — pure-presentational. Receive props + callbacks, render. Do not call `chrome.*` themselves.

**Content side (the only side that knows about YouTube.)**

- `content.ts` — registers `chrome.runtime.onMessage.addListener`. Reads `msg.type`, dispatches to the matching `lib/youtube/*` function. For `ADD_VIDEOS`, emits multiple `PROGRESS` messages followed by `ADD_DONE`. Stays short (~100 lines).
- `lib/youtube/innertube.ts` — exposes `innertubeFetch(endpoint, payload)` which (a) reads `ytcfg` from `window`, (b) builds the request body with the standard Innertube `context` block, (c) POSTs to `https://www.youtube.com/youtubei/v1/<endpoint>?key=<API_KEY>`, (d) returns parsed JSON. All other YouTube files depend on this and only this for HTTP.
- `lib/youtube/channel.ts` — reads channel ID/name from the active page's URL or DOM (e.g., `ytInitialData`, `meta[itemprop=channelId]`).
- `lib/youtube/playlists.ts` — `listMyPlaylists()` and `createPlaylist(title)` using `innertubeFetch`.
- `lib/youtube/videoFetcher.ts` — `fetchVideos(channelId, mode, count)`. For `latest`/`popular`, paginates the channel's Videos or Popular tab until N collected. For `oldest`, paginates the full Videos tab and returns the last N reversed.
- `lib/youtube/videoAdder.ts` — `addVideos(playlistId, videoIds, onProgress)`. Chunks into batches (initial: 20/batch), calls Innertube `browse/edit_playlist` with `ACTION_ADD_VIDEO` per ID, awaits a small delay between batches, invokes `onProgress(added, total)` after each batch.
- `lib/youtube/dedupe.ts` — pure: `videosToAdd(fetched, existingInPlaylist) -> Video[]`. No I/O. The "list current playlist contents" call lives in `playlists.ts` (`listPlaylistVideoIds(playlistId)`); `dedupe.ts` is kept pure-only so it is trivial to unit-test.

**Shared (both sides import).**

- `lib/messaging.ts` — exports `sendMessage<TReq, TResp>(msg)` for the popup, and a small helper to register a typed handler in the content script. Does **not** call `addListener` itself.
- `lib/types.ts` — `Mode`, `Video`, `Playlist`, `Message` union, response payload types. Pure types; emitted as nothing at runtime (TypeScript-only).

## 5. Message protocol

All messages have a `type` discriminant. Defined as a TypeScript discriminated union in `lib/types.ts`. The popup sends requests; the content script replies with results (or streams PROGRESS during long ops).

| Direction | Message | Payload | Reply |
|---|---|---|---|
| popup → content | `GET_CHANNEL` | – | `CHANNEL_RESULT { id, name }` or `ERROR { reason }` |
| popup → content | `GET_PLAYLISTS` | – | `PLAYLISTS_RESULT { items: Playlist[] }` |
| popup → content | `CREATE_PLAYLIST` | `{ title }` | `PLAYLIST_CREATED { playlist }` |
| popup → content | `ADD_VIDEOS` | `{ channelId, mode, count, playlistId }` | streamed `PROGRESS { added, total, lastAddedId }`, ending with `ADD_DONE { added, skipped, failed, failureReason? }` |

The progress channel is implemented via `chrome.runtime.sendMessage` from content to runtime; the popup registers a listener and updates state on each `PROGRESS`. (Alternative: long-lived port via `chrome.runtime.connect`. We use the simpler approach unless we observe message drops in practice.)

## 6. Data shapes

```ts
type Mode = 'latest' | 'oldest' | 'popular';

interface Video {
  id: string;            // YouTube video ID
  title: string;
  channelId: string;
  durationSec?: number;  // optional, used in future filters
  viewCount?: number;    // optional, used in future filters
}

interface Playlist {
  id: string;
  title: string;
  videoCount: number;
}

type Message =
  | { type: 'GET_CHANNEL' }
  | { type: 'CHANNEL_RESULT'; id: string; name: string }
  | { type: 'GET_PLAYLISTS' }
  | { type: 'PLAYLISTS_RESULT'; items: Playlist[] }
  | { type: 'CREATE_PLAYLIST'; title: string }
  | { type: 'PLAYLIST_CREATED'; playlist: Playlist }
  | { type: 'ADD_VIDEOS'; channelId: string; mode: Mode; count: number; playlistId: string }
  | { type: 'PROGRESS'; added: number; total: number; lastAddedId: string }
  | { type: 'ADD_DONE'; added: number; skipped: number; failed: number; failureReason?: string }
  | { type: 'ERROR'; reason: string };
```

## 7. Error handling

- **No active YouTube tab / not on a channel page.** Popup detects on mount via the URL of the active tab; shows a friendly "Open a YouTube channel page first" message and disables controls.
- **Network or 4xx/5xx from Innertube.** `innertubeFetch` throws; callers translate to `{ type: 'ERROR', reason }`. The popup surfaces this in the summary area.
- **Partial failure during `ADD_VIDEOS`.** Loop continues only if errors are retryable. Up to 3 retries per batch with exponential backoff (200ms → 800ms → 2s). After 3 retries, the run aborts; what's already added is kept. `ADD_DONE` reports the partial counts.
- **Auth lost mid-run** (cookies cleared, signed out). Treated as a hard error; abort and report.
- **Rate limit signals.** If the Innertube response indicates throttling, double the inter-batch delay for the rest of the run.

## 8. Testing

Tests focus on pure logic. DOM-touching and network code is kept thin enough not to require tests.

- `dedupe.test.ts` — given a fetched list and an "existing in playlist" list, returns the correct subset, preserving order, with no duplicates.
- `videoFetcher.test.ts` — with `innertubeFetch` mocked, verifies pagination terminates at the requested count for `latest`/`popular`, and that `oldest` walks all pages and returns the last N reversed.
- `messaging.test.ts` — covers the discriminated-union narrowing and the `sendMessage` typing surface.

Manual test plan:
- Smoke test on three real channels of increasing size (small / medium / 1000+ videos).
- Verify dedupe by running the same operation twice and confirming the second run reports all videos as skipped.
- Verify partial failure by introducing an artificial throw in `videoAdder.ts` and confirming `ADD_DONE` reports the right counts.

## 9. Tooling decisions

- **Vite + `@crxjs/vite-plugin`** — build, MV3-aware. Fast HMR for popup. Mainstream and well-documented.
- **TypeScript** — catches data-shape mistakes that would otherwise be silent at runtime. Especially valuable across the message boundary, where a missing field is impossible to debug without types.
- **React 18** — popup is interactive enough to benefit from React's "state → re-render" model. No state management library; `useState` + `useReducer` are enough.
- **Vitest** — pairs naturally with Vite.

## 10. Open items, intentionally deferred

- **Min-view-count filter.** Data shape (`Video.viewCount`) accommodates it; UI/wiring will be added in a follow-up.
- **Long-lived ports.** Initial implementation uses one-shot `sendMessage` for progress. If we observe message drops, migrate to `chrome.runtime.connect`.
- **Service worker fallback** for runs without an open YouTube tab. Not in v1.
- **Cross-extension persistence of in-flight runs.** A 1000-video run that's interrupted by tab close is lost (user re-runs to recover; dedupe makes this safe).
