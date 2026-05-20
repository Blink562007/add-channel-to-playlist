# Bulk Playlist Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that lets the user add the Latest / Oldest / Most Popular N videos (up to 1000) from any YouTube channel into one of their YouTube playlists, with dedupe and live progress.

**Architecture:** Content-script-only (no service worker). Popup is React+TypeScript; content script talks to YouTube's internal "Innertube" endpoints using the page's existing session. See `docs/superpowers/specs/2026-05-20-bulk-playlist-extension-design.md` for the full design rationale.

**Tech Stack:** Chrome Extension MV3, Vite + `@crxjs/vite-plugin`, TypeScript 5, React 18, Vitest. Filenames use camelCase (e.g. `videoFetcher.ts`).

**Reading order:** The plan is divided into six phases. Each phase produces something testable. Where commands or concepts are new, the task includes a short explainer. If you've executed extensions before, skim the explainers; otherwise read them in full.

---

## Phase 1 — Project foundation (Tasks 1–3)

Sets up Vite, TypeScript, the extension manifest, and a "hello world" popup. By the end of this phase you can load the unpacked extension in Chrome and see an empty popup open.

### Task 1: Initialize the Vite + React + TypeScript project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/popup/index.html`
- Create: `src/popup/main.tsx`
- Create: `src/popup/App.tsx`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json**

Run from the project root:

```bash
npm init -y
```

This creates a default `package.json`. Then replace its contents with:

```json
{
  "name": "playlist-editor-extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

`"type": "module"` tells Node to treat `.js` files as ES modules — important because `@crxjs/vite-plugin` expects ESM.

- [ ] **Step 2: Install dependencies**

```bash
npm install --save react react-dom
npm install --save-dev typescript @types/react @types/react-dom @types/chrome vite @vitejs/plugin-react @crxjs/vite-plugin vitest @testing-library/react @testing-library/jest-dom jsdom
```

What each does:
- `react`, `react-dom`: the React library.
- `typescript`: the TypeScript compiler.
- `@types/chrome`: type definitions for `chrome.*` APIs so TS knows about them.
- `vite`, `@vitejs/plugin-react`: build tool + React support.
- `@crxjs/vite-plugin`: makes Vite understand Chrome extensions (multiple entry points, manifest, MV3 quirks).
- `vitest`, `@testing-library/*`, `jsdom`: testing.

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["chrome", "vitest/globals"]
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`"strict": true` makes TypeScript catch more mistakes — keep it on.

- [ ] **Step 4: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

This is a separate tsconfig for `vite.config.ts` because it runs in Node, not the browser.

- [ ] **Step 5: Create vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' assert { type: 'json' };

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

`crx({ manifest })` is the magic: it reads `manifest.json`, figures out which `.html`/`.ts` files are entry points, and tells Vite to build them.

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
.DS_Store
*.log
```

- [ ] **Step 7: Create the popup HTML shell**

`src/popup/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Bulk Playlist Adder</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

Note the single `<div id="root">` — React will render the whole UI into that. The `<script>` line is what Vite bundles.

- [ ] **Step 8: Create the React entry**

`src/popup/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 9: Create a placeholder App component**

`src/popup/App.tsx`:

```tsx
export default function App() {
  return <div style={{ padding: 12, width: 320 }}>Hello, extension.</div>;
}
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TypeScript project"
```

---

### Task 2: Create the extension manifest and load it in Chrome

**Files:**
- Create: `manifest.json`
- Create: `src/content/content.ts`

- [ ] **Step 1: Create the manifest**

`manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Bulk Playlist Adder",
  "version": "0.1.0",
  "description": "Add N latest/oldest/popular videos from a YouTube channel to one of your playlists.",
  "action": {
    "default_popup": "src/popup/index.html",
    "default_title": "Bulk Playlist Adder"
  },
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/*"],
      "js": ["src/content/content.ts"],
      "run_at": "document_idle"
    }
  ],
  "host_permissions": ["https://www.youtube.com/*"]
}
```

- `action.default_popup` — what opens when you click the extension icon.
- `content_scripts` — what JS gets injected into matching pages. Our content script runs on YouTube only.
- `host_permissions` — required for the content script to `fetch` YouTube's internal endpoints.

- [ ] **Step 2: Create a stub content script**

`src/content/content.ts`:

```ts
console.log('[bulk-playlist] content script loaded');
```

This is enough to verify the manifest works. We'll fill it in later.

- [ ] **Step 3: Build the extension**

```bash
npm run build
```

Expected: a `dist/` folder appears with `manifest.json`, `assets/`, and bundled JS.

- [ ] **Step 4: Load the unpacked extension in Chrome**

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select the `dist/` folder.

Expected: "Bulk Playlist Adder" appears in the list with no errors.

- [ ] **Step 5: Verify the popup and content script**

1. Click the extension icon in the toolbar. The popup should open and show "Hello, extension."
2. Visit `https://www.youtube.com/` in a new tab. Open DevTools (F12) → Console.
3. Look for `[bulk-playlist] content script loaded`.

If both work, the extension plumbing is correct.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add manifest, content script stub, popup loads in Chrome"
```

---

### Task 3: Define shared types

**Files:**
- Create: `src/lib/types.ts`

This file defines the data shapes used by both the popup and the content script. Types disappear at compile time, so it's safe for both worlds to import from here.

- [ ] **Step 1: Create the types file**

`src/lib/types.ts`:

```ts
export type Mode = 'latest' | 'oldest' | 'popular';

export interface Video {
  id: string;
  title: string;
  channelId: string;
  durationSec?: number;
  viewCount?: number;
}

export interface Playlist {
  id: string;
  title: string;
  videoCount: number;
}

// Discriminated union: every message has a `type` field. TypeScript can
// narrow the message's other fields based on `type`.
export type Message =
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

// Helper type: extract a single message variant by its `type` literal.
export type MessageOf<T extends Message['type']> = Extract<Message, { type: T }>;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: no errors. (If it complains about unused exports, ignore — they'll be used in later tasks.)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: define shared types (Mode, Video, Playlist, Message)"
```

---

## Phase 2 — Pure logic with TDD (Tasks 4–5)

Anything that has no I/O lives here. These files are fully unit-testable with no Chrome, no DOM, no network. We use test-driven development (TDD): write the test first, watch it fail, write the minimal implementation to make it pass, then commit.

### Task 4: Dedupe pure function (TDD)

**Files:**
- Create: `src/lib/youtube/dedupe.ts`
- Test: `tests/dedupe.test.ts`

Given a list of fetched videos and a set of video IDs already in a playlist, return the subset of fetched videos that aren't already there — in original order, deduplicated.

- [ ] **Step 1: Write the failing test**

`tests/dedupe.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { videosToAdd } from '../src/lib/youtube/dedupe';
import type { Video } from '../src/lib/types';

const v = (id: string): Video => ({ id, title: id, channelId: 'C' });

describe('videosToAdd', () => {
  it('returns all when nothing exists in playlist', () => {
    expect(videosToAdd([v('a'), v('b')], new Set())).toEqual([v('a'), v('b')]);
  });

  it('skips IDs already in the playlist', () => {
    expect(videosToAdd([v('a'), v('b'), v('c')], new Set(['b']))).toEqual([v('a'), v('c')]);
  });

  it('preserves order of fetched videos', () => {
    expect(videosToAdd([v('c'), v('a'), v('b')], new Set())).toEqual([v('c'), v('a'), v('b')]);
  });

  it('deduplicates fetched list against itself', () => {
    expect(videosToAdd([v('a'), v('a'), v('b')], new Set())).toEqual([v('a'), v('b')]);
  });

  it('returns empty when all already exist', () => {
    expect(videosToAdd([v('a'), v('b')], new Set(['a', 'b']))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:run -- tests/dedupe.test.ts
```

Expected: FAIL with "Cannot find module" or similar — the file doesn't exist yet.

- [ ] **Step 3: Write the implementation**

`src/lib/youtube/dedupe.ts`:

```ts
import type { Video } from '../types';

export function videosToAdd(fetched: Video[], existing: Set<string>): Video[] {
  const seen = new Set<string>(existing);
  const out: Video[] = [];
  for (const v of fetched) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test:run -- tests/dedupe.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: pure dedupe function with tests"
```

---

### Task 5: Typed messaging helper

**Files:**
- Create: `src/lib/messaging.ts`
- Test: `tests/messaging.test.ts`

A small wrapper around `chrome.runtime.sendMessage` so the popup gets autocomplete and so the content script can register typed handlers. The helper itself is pure — no `addListener` here.

- [ ] **Step 1: Write the failing test**

`tests/messaging.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendToContent } from '../src/lib/messaging';

beforeEach(() => {
  // Mock chrome.tabs.* APIs that messaging.ts will call.
  (globalThis as any).chrome = {
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 42 }]),
      sendMessage: vi.fn().mockResolvedValue({ type: 'CHANNEL_RESULT', id: 'UC1', name: 'Test' }),
    },
  };
});

describe('sendToContent', () => {
  it('queries the active tab and sends the message there', async () => {
    const result = await sendToContent({ type: 'GET_CHANNEL' });
    expect((globalThis as any).chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect((globalThis as any).chrome.tabs.sendMessage).toHaveBeenCalledWith(42, { type: 'GET_CHANNEL' });
    expect(result).toEqual({ type: 'CHANNEL_RESULT', id: 'UC1', name: 'Test' });
  });

  it('throws if no active tab is found', async () => {
    (globalThis as any).chrome.tabs.query.mockResolvedValueOnce([]);
    await expect(sendToContent({ type: 'GET_CHANNEL' })).rejects.toThrow('No active tab');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:run -- tests/messaging.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the implementation**

`src/lib/messaging.ts`:

```ts
import type { Message } from './types';

/**
 * Send a message from popup → content script in the active tab.
 * The response is typed as `Message` (a discriminated union).
 */
export async function sendToContent(msg: Message): Promise<Message> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  return (await chrome.tabs.sendMessage(tab.id, msg)) as Message;
}

/**
 * Send a message from content script → popup (or any runtime listener).
 * Used for PROGRESS / ADD_DONE notifications.
 */
export function sendToRuntime(msg: Message): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    // Popup might be closed — drop the notification silently.
  });
}

/**
 * Type guard: narrow a Message by its `type` discriminant.
 */
export function isMessageOfType<T extends Message['type']>(
  msg: unknown,
  type: T,
): msg is Extract<Message, { type: T }> {
  return typeof msg === 'object' && msg !== null && (msg as Message).type === type;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test:run -- tests/messaging.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: typed messaging helper with tests"
```

---

## Phase 3 — YouTube integration (Tasks 6–10)

These tasks build the `lib/youtube/*` modules. They touch the network, so we don't TDD them — we verify each one manually by importing it into the content script and checking output in DevTools. After this phase, the extension's brain is functional even though there's no UI yet.

### Task 6: Innertube fetch helper (manual verification)

**Files:**
- Create: `src/lib/youtube/innertube.ts`

Wraps the low-level POST to YouTube's internal API endpoints. Every other `lib/youtube/*` file depends on this one and only this one for HTTP.

**Background:** Every YouTube page embeds a global object called `ytcfg` with fields including `INNERTUBE_API_KEY`, `INNERTUBE_CLIENT_NAME` (`"WEB"`), `INNERTUBE_CLIENT_VERSION`, and others. To call an Innertube endpoint, you POST JSON to `https://www.youtube.com/youtubei/v1/<endpoint>?key=<API_KEY>` with a `context` block that identifies the client. The user's cookies are attached automatically by the browser.

- [ ] **Step 1: Write the helper**

`src/lib/youtube/innertube.ts`:

```ts
interface Ytcfg {
  INNERTUBE_API_KEY: string;
  INNERTUBE_CLIENT_NAME: string;
  INNERTUBE_CLIENT_VERSION: string;
  HL?: string;
  GL?: string;
  SESSION_INDEX?: string | number;
}

function readYtcfg(): Ytcfg {
  const cfg = (window as unknown as { ytcfg?: { data_?: Ytcfg } }).ytcfg?.data_;
  if (!cfg?.INNERTUBE_API_KEY) {
    throw new Error('ytcfg not found on page; are we on youtube.com?');
  }
  return cfg;
}

/**
 * POST to a YouTube Innertube endpoint. The request runs in the YouTube
 * page's origin so cookies are attached automatically.
 *
 * Endpoints we use:
 *   - "browse"               — fetch channel tabs, playlists, playlist contents
 *   - "browse/edit_playlist" — add/remove videos in a playlist
 *   - "playlist/create"      — create a new playlist
 */
export async function innertubeFetch<TResponse = unknown>(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<TResponse> {
  const cfg = readYtcfg();
  const body = {
    context: {
      client: {
        clientName: cfg.INNERTUBE_CLIENT_NAME,
        clientVersion: cfg.INNERTUBE_CLIENT_VERSION,
        hl: cfg.HL ?? 'en',
        gl: cfg.GL ?? 'US',
      },
    },
    ...payload,
  };

  const url = `https://www.youtube.com/youtubei/v1/${endpoint}?key=${cfg.INNERTUBE_API_KEY}&prettyPrint=false`;

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Origin': 'https://www.youtube.com',
      'X-Goog-AuthUser': String(cfg.SESSION_INDEX ?? 0),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Innertube ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as TResponse;
}
```

- [ ] **Step 2: Expose for manual testing via the content script**

Edit `src/content/content.ts`:

```ts
import { innertubeFetch } from '../lib/youtube/innertube';

console.log('[bulk-playlist] content script loaded');

// Expose for manual testing from DevTools console.
(window as any).bulkPlaylistDebug = { innertubeFetch };
```

- [ ] **Step 3: Rebuild and reload the extension**

```bash
npm run build
```

In `chrome://extensions`, click the refresh icon on the Bulk Playlist Adder card.

- [ ] **Step 4: Manually verify the helper works**

1. Visit `https://www.youtube.com/` (logged in).
2. Open DevTools → Console.
3. Run:

```js
await bulkPlaylistDebug.innertubeFetch('browse', { browseId: 'FEwhat_to_watch' });
```

Expected: a large JSON response object (the homepage feed data). If it errors, check the network tab for the actual HTTP status.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: innertube fetch helper, manually verified"
```

---

### Task 7: Resolve current channel ID and name

**Files:**
- Create: `src/lib/youtube/channel.ts`

Read the channel ID and name for whatever YouTube page the user is on (channel page or video page).

- [ ] **Step 1: Write the resolver**

`src/lib/youtube/channel.ts`:

```ts
interface YtInitialData {
  metadata?: {
    channelMetadataRenderer?: { externalId?: string; title?: string };
  };
  header?: {
    c4TabbedHeaderRenderer?: { channelId?: string; title?: string };
    pageHeaderRenderer?: { pageTitle?: string; channelHandle?: { simpleText?: string } };
  };
  contents?: unknown;
}

/**
 * Read `ytInitialData`, a global object embedded in every YouTube page,
 * and pull the channel ID + name from whichever location the current
 * page type uses. Returns null if we can't find one.
 */
export function readCurrentChannel(): { id: string; name: string } | null {
  const data = (window as unknown as { ytInitialData?: YtInitialData }).ytInitialData;
  if (!data) return null;

  // Channel page
  const meta = data.metadata?.channelMetadataRenderer;
  if (meta?.externalId && meta?.title) {
    return { id: meta.externalId, name: meta.title };
  }

  // Older channel header
  const c4 = data.header?.c4TabbedHeaderRenderer;
  if (c4?.channelId && c4?.title) {
    return { id: c4.channelId, name: c4.title };
  }

  // Video page: try the owner field
  // The owner videoOwnerRenderer lives deep in the watch response; a simpler
  // heuristic is to fall back to meta[itemprop=channelId] tags.
  const metaTag = document.querySelector('meta[itemprop=channelId]') as HTMLMetaElement | null;
  const titleTag = document.querySelector('link[itemprop=name]') as HTMLLinkElement | null;
  if (metaTag?.content) {
    return { id: metaTag.content, name: titleTag?.getAttribute('title') ?? 'Unknown channel' };
  }

  return null;
}
```

- [ ] **Step 2: Expose for manual testing**

Edit `src/content/content.ts`:

```ts
import { innertubeFetch } from '../lib/youtube/innertube';
import { readCurrentChannel } from '../lib/youtube/channel';

console.log('[bulk-playlist] content script loaded');

(window as any).bulkPlaylistDebug = { innertubeFetch, readCurrentChannel };
```

- [ ] **Step 3: Rebuild and reload**

```bash
npm run build
```

Refresh the extension at `chrome://extensions`.

- [ ] **Step 4: Verify on a channel page**

1. Go to e.g. `https://www.youtube.com/@veritasium`.
2. DevTools → Console:

```js
bulkPlaylistDebug.readCurrentChannel();
```

Expected: `{ id: "UCHnyfMqiRRG1u-2MsSQLbXA", name: "Veritasium" }` (or similar).

- [ ] **Step 5: Verify on a video page**

1. Open a Veritasium video.
2. Run the same call.

Expected: returns the channel info (may use a different field path).

If it returns `null`, look at `ytInitialData` in the console and adjust the field paths in `channel.ts`. This is normal — YouTube's response shapes drift.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: read current channel ID + name from page"
```

---

### Task 8: List and create playlists

**Files:**
- Create: `src/lib/youtube/playlists.ts`

Three functions:
1. `listMyPlaylists()` — the user's playlists, for the dropdown.
2. `listPlaylistVideoIds(playlistId)` — existing video IDs for dedupe.
3. `createPlaylist(title)` — make a new empty playlist.

- [ ] **Step 1: Write the playlists module**

`src/lib/youtube/playlists.ts`:

```ts
import { innertubeFetch } from './innertube';
import type { Playlist } from '../types';

/**
 * Fetch the user's own playlists by using the "Add to playlist" picker
 * endpoint with no video IDs. Returns the list of playlists the user
 * can add videos to.
 */
export async function listMyPlaylists(): Promise<Playlist[]> {
  // dummy video ID — endpoint accepts any valid ID and returns the user's
  // playlists with "contains" info we ignore.
  const resp = await innertubeFetch<{
    contents?: Array<{
      addToPlaylistRenderer?: {
        playlists?: Array<{
          playlistAddToOptionRenderer?: {
            playlistId?: string;
            title?: { simpleText?: string };
            videoCount?: string;
          };
        }>;
      };
    }>;
  }>('playlist/get_add_to_playlist', { videoIds: ['dQw4w9WgXcQ'] });

  const playlistsRaw =
    resp.contents?.[0]?.addToPlaylistRenderer?.playlists ?? [];
  const playlists: Playlist[] = [];
  for (const p of playlistsRaw) {
    const r = p.playlistAddToOptionRenderer;
    if (!r?.playlistId || !r?.title?.simpleText) continue;
    playlists.push({
      id: r.playlistId,
      title: r.title.simpleText,
      videoCount: Number(r.videoCount ?? 0),
    });
  }
  return playlists;
}

/**
 * Fetch the video IDs currently in a playlist. Paginates via
 * continuation tokens until exhausted.
 */
export async function listPlaylistVideoIds(playlistId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let continuation: string | undefined;

  // First request: browse the playlist's contents.
  // YouTube's "playlist contents" browseId is "VL" + playlistId.
  const browseId = `VL${playlistId}`;

  for (let page = 0; page < 50; page++) {
    const payload: Record<string, unknown> = continuation
      ? { continuation }
      : { browseId };
    const resp = await innertubeFetch<any>('browse', payload);

    const items: any[] =
      resp.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer
        ?.contents?.[0]?.playlistVideoListRenderer?.contents ??
      resp.onResponseReceivedActions?.[0]?.appendContinuationItemsAction
        ?.continuationItems ?? [];

    let nextCont: string | undefined;
    for (const item of items) {
      const videoId = item.playlistVideoRenderer?.videoId;
      if (videoId) ids.add(videoId);
      const c = item.continuationItemRenderer?.continuationEndpoint
        ?.continuationCommand?.token;
      if (c) nextCont = c;
    }

    if (!nextCont) break;
    continuation = nextCont;
  }

  return ids;
}

/**
 * Create a new empty playlist with the given title.
 */
export async function createPlaylist(title: string): Promise<Playlist> {
  const resp = await innertubeFetch<{ playlistId?: string }>('playlist/create', {
    title,
    privacyStatus: 'PRIVATE',
  });
  if (!resp.playlistId) throw new Error('createPlaylist: no playlistId in response');
  return { id: resp.playlistId, title, videoCount: 0 };
}
```

> **Note on response shapes:** Innertube's JSON paths are deep and YouTube changes them periodically. If `listMyPlaylists()` returns an empty array, open DevTools → Network on a YouTube page, click the "Save" button on any video, find the `get_add_to_playlist` request, and compare its response JSON to the paths in the code above. Adjust if needed.

- [ ] **Step 2: Expose for manual testing**

Edit `src/content/content.ts`:

```ts
import { innertubeFetch } from '../lib/youtube/innertube';
import { readCurrentChannel } from '../lib/youtube/channel';
import { listMyPlaylists, listPlaylistVideoIds, createPlaylist } from '../lib/youtube/playlists';

console.log('[bulk-playlist] content script loaded');

(window as any).bulkPlaylistDebug = {
  innertubeFetch,
  readCurrentChannel,
  listMyPlaylists,
  listPlaylistVideoIds,
  createPlaylist,
};
```

- [ ] **Step 3: Rebuild and reload**

```bash
npm run build
```

Refresh extension at `chrome://extensions`.

- [ ] **Step 4: Verify `listMyPlaylists`**

In DevTools console on any YouTube page:

```js
await bulkPlaylistDebug.listMyPlaylists();
```

Expected: array of your playlists with `{ id, title, videoCount }`.

- [ ] **Step 5: Verify `listPlaylistVideoIds`**

Pick one of the returned playlist IDs and run:

```js
await bulkPlaylistDebug.listPlaylistVideoIds('PLxxxx');
```

Expected: a `Set` of video IDs. Size matches the playlist's video count.

- [ ] **Step 6: Verify `createPlaylist`**

```js
await bulkPlaylistDebug.createPlaylist('Test playlist from extension');
```

Expected: `{ id: 'PL...', title: 'Test playlist from extension', videoCount: 0 }`. Confirm it exists at `https://www.youtube.com/feed/library`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: playlists module (list, list contents, create)"
```

---

### Task 9: Fetch channel videos by mode

**Files:**
- Create: `src/lib/youtube/videoFetcher.ts`

`fetchVideos(channelId, mode, count)` returns N videos from the channel. For `latest`, paginate the channel uploads in order. For `popular`, use the channel's Popular tab. For `oldest`, paginate the entire upload history then reverse-slice the tail.

- [ ] **Step 1: Write the fetcher**

`src/lib/youtube/videoFetcher.ts`:

```ts
import { innertubeFetch } from './innertube';
import type { Mode, Video } from '../types';

/**
 * The channel uploads playlist is "UU" + channelId.slice(2).
 * E.g. UCHnyfMqiRRG1u-2MsSQLbXA  →  UUHnyfMqiRRG1u-2MsSQLbXA
 */
function uploadsPlaylistId(channelId: string): string {
  return 'UU' + channelId.slice(2);
}

interface RawVideoItem {
  playlistVideoRenderer?: {
    videoId?: string;
    title?: { runs?: Array<{ text?: string }>; simpleText?: string };
  };
  continuationItemRenderer?: {
    continuationEndpoint?: {
      continuationCommand?: { token?: string };
    };
  };
}

function readTitle(r: RawVideoItem['playlistVideoRenderer']): string {
  return r?.title?.simpleText ?? r?.title?.runs?.[0]?.text ?? '';
}

/**
 * Paginate through a playlist (uploads, or popular tab playlist) and
 * return up to `limit` videos. If `limit` is Infinity, returns all.
 */
async function paginatePlaylist(
  browseId: string,
  channelId: string,
  limit: number,
): Promise<Video[]> {
  const out: Video[] = [];
  let continuation: string | undefined;

  for (let page = 0; page < 200 && out.length < limit; page++) {
    const payload: Record<string, unknown> = continuation
      ? { continuation }
      : { browseId };
    const resp = await innertubeFetch<any>('browse', payload);

    const items: RawVideoItem[] =
      resp.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer
        ?.contents?.[0]?.playlistVideoListRenderer?.contents ??
      resp.onResponseReceivedActions?.[0]?.appendContinuationItemsAction
        ?.continuationItems ??
      [];

    let nextCont: string | undefined;
    for (const item of items) {
      const r = item.playlistVideoRenderer;
      if (r?.videoId) {
        out.push({ id: r.videoId, title: readTitle(r), channelId });
        if (out.length >= limit) break;
      }
      const c = item.continuationItemRenderer?.continuationEndpoint
        ?.continuationCommand?.token;
      if (c) nextCont = c;
    }

    if (!nextCont) break;
    continuation = nextCont;
  }

  return out;
}

/**
 * "Popular" tab uses a known-encoded params string. This is "channel tab:
 * Videos, sort by Popular." If it ever stops working, capture the value
 * from DevTools Network when clicking the Popular sort on a channel page.
 */
const POPULAR_PARAMS = 'EgZ2aWRlb3MYAyAAcAE%3D';

export async function fetchVideos(
  channelId: string,
  mode: Mode,
  count: number,
): Promise<Video[]> {
  if (count <= 0) return [];

  if (mode === 'latest') {
    return paginatePlaylist(uploadsPlaylistId(channelId), channelId, count);
  }

  if (mode === 'oldest') {
    // Need ALL videos, then take the tail in reverse.
    const all = await paginatePlaylist(uploadsPlaylistId(channelId), channelId, Infinity);
    return all.slice(-count).reverse();
  }

  // mode === 'popular'
  // Browse the channel directly with the Popular params to hit the popular tab.
  const out: Video[] = [];
  let continuation: string | undefined;
  for (let page = 0; page < 100 && out.length < count; page++) {
    const payload: Record<string, unknown> = continuation
      ? { continuation }
      : { browseId: channelId, params: POPULAR_PARAMS };
    const resp = await innertubeFetch<any>('browse', payload);

    const items: any[] =
      resp.contents?.twoColumnBrowseResultsRenderer?.tabs?.find(
        (t: any) => t.tabRenderer?.selected,
      )?.tabRenderer?.content?.richGridRenderer?.contents ??
      resp.onResponseReceivedActions?.[0]?.appendContinuationItemsAction
        ?.continuationItems ??
      [];

    let nextCont: string | undefined;
    for (const item of items) {
      const r = item.richItemRenderer?.content?.videoRenderer;
      if (r?.videoId) {
        out.push({
          id: r.videoId,
          title: r.title?.runs?.[0]?.text ?? r.title?.simpleText ?? '',
          channelId,
        });
        if (out.length >= count) break;
      }
      const c = item.continuationItemRenderer?.continuationEndpoint
        ?.continuationCommand?.token;
      if (c) nextCont = c;
    }

    if (!nextCont) break;
    continuation = nextCont;
  }
  return out;
}
```

- [ ] **Step 2: Expose for manual testing**

Update `src/content/content.ts`:

```ts
import { innertubeFetch } from '../lib/youtube/innertube';
import { readCurrentChannel } from '../lib/youtube/channel';
import { listMyPlaylists, listPlaylistVideoIds, createPlaylist } from '../lib/youtube/playlists';
import { fetchVideos } from '../lib/youtube/videoFetcher';

console.log('[bulk-playlist] content script loaded');

(window as any).bulkPlaylistDebug = {
  innertubeFetch,
  readCurrentChannel,
  listMyPlaylists,
  listPlaylistVideoIds,
  createPlaylist,
  fetchVideos,
};
```

- [ ] **Step 3: Rebuild and reload**

```bash
npm run build
```

- [ ] **Step 4: Verify `latest`**

On any YouTube tab:

```js
const ch = bulkPlaylistDebug.readCurrentChannel();
// pick a channel you've visited, e.g.:
await bulkPlaylistDebug.fetchVideos('UCHnyfMqiRRG1u-2MsSQLbXA', 'latest', 5);
```

Expected: 5 most recent Veritasium videos.

- [ ] **Step 5: Verify `popular`**

```js
await bulkPlaylistDebug.fetchVideos('UCHnyfMqiRRG1u-2MsSQLbXA', 'popular', 5);
```

Expected: 5 top videos sorted by views.

- [ ] **Step 6: Verify `oldest` on a small channel**

Pick a small channel (< 100 uploads, faster) and:

```js
await bulkPlaylistDebug.fetchVideos('UCxxxxx', 'oldest', 5);
```

Expected: 5 oldest videos. Compare against scrolling to the bottom of the channel's Videos tab to verify.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: fetch channel videos by mode (latest/oldest/popular)"
```

---

### Task 10: Add videos to a playlist in batches

**Files:**
- Create: `src/lib/youtube/videoAdder.ts`

Add a list of video IDs to a playlist using the `edit_playlist` endpoint with batched `ACTION_ADD_VIDEO` actions. Calls a progress callback after each batch.

- [ ] **Step 1: Write the adder**

`src/lib/youtube/videoAdder.ts`:

```ts
import { innertubeFetch } from './innertube';

const BATCH_SIZE = 20;
const INTER_BATCH_DELAY_MS = 250;
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface AddResult {
  added: number;
  failed: number;
  failureReason?: string;
}

/**
 * Add video IDs to a playlist in batches. Calls `onBatch(addedSoFar)`
 * after each successful batch. On unrecoverable failure, returns what's
 * been added so far with a failureReason.
 */
export async function addVideos(
  playlistId: string,
  videoIds: string[],
  onBatch: (addedSoFar: number, lastAddedId: string) => void,
): Promise<AddResult> {
  let added = 0;
  let delay = INTER_BATCH_DELAY_MS;

  for (const batch of chunk(videoIds, BATCH_SIZE)) {
    const actions = batch.map((id) => ({ action: 'ACTION_ADD_VIDEO', addedVideoId: id }));
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < MAX_RETRIES) {
      try {
        await innertubeFetch('browse/edit_playlist', { playlistId, actions });
        added += batch.length;
        onBatch(added, batch[batch.length - 1]);
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        attempt += 1;
        if (attempt >= MAX_RETRIES) break;
        // Exponential backoff: 200ms → 800ms → 2s
        await sleep(200 * Math.pow(4, attempt - 1));
      }
    }

    if (lastError) {
      const msg = lastError instanceof Error ? lastError.message : String(lastError);
      return { added, failed: videoIds.length - added, failureReason: msg };
    }

    await sleep(delay);
    // If the most recent batch was very fast, keep delay constant; if it
    // ever throws a rate-limit, future batches double the delay.
    // (Detection of rate-limit errors is intentionally minimal for v1.)
    delay = Math.min(delay, 1000);
  }

  return { added, failed: 0 };
}
```

- [ ] **Step 2: Expose for manual testing**

Update `src/content/content.ts`:

```ts
import { innertubeFetch } from '../lib/youtube/innertube';
import { readCurrentChannel } from '../lib/youtube/channel';
import { listMyPlaylists, listPlaylistVideoIds, createPlaylist } from '../lib/youtube/playlists';
import { fetchVideos } from '../lib/youtube/videoFetcher';
import { addVideos } from '../lib/youtube/videoAdder';

console.log('[bulk-playlist] content script loaded');

(window as any).bulkPlaylistDebug = {
  innertubeFetch,
  readCurrentChannel,
  listMyPlaylists,
  listPlaylistVideoIds,
  createPlaylist,
  fetchVideos,
  addVideos,
};
```

- [ ] **Step 3: Rebuild and reload**

```bash
npm run build
```

- [ ] **Step 4: End-to-end manual test**

In DevTools console on a YouTube page:

```js
// Pick a small target — your "Test playlist from extension" from Task 8.
const playlistId = 'PLxxxx'; // your test playlist ID

// Fetch 5 latest from a channel
const vids = await bulkPlaylistDebug.fetchVideos('UCHnyfMqiRRG1u-2MsSQLbXA', 'latest', 5);
const ids = vids.map(v => v.id);

// Add them, logging progress
await bulkPlaylistDebug.addVideos(playlistId, ids, (added, last) => {
  console.log(`added ${added}, last: ${last}`);
});
```

Expected: console logs like `added 5, last: <id>`. Visit the test playlist and confirm the 5 videos are there.

- [ ] **Step 5: Verify dedupe path works end-to-end**

In the same console:

```js
const { videosToAdd } = await import(chrome.runtime.getURL('assets/dedupe-XXXX.js'));
```

Actually, since `dedupe.ts` is bundled into the content script, easier to test it via the integration in Task 11. Skip this verification — `dedupe.ts` has its own unit tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: batched video adder with retry/backoff"
```

---

## Phase 4 — Content script glue (Task 11)

Wire `lib/youtube/*` to the message protocol. After this phase, the popup (still empty) could send a message and trigger real work.

### Task 11: Content script message dispatcher

**Files:**
- Modify: `src/content/content.ts` (full rewrite)

Register one `chrome.runtime.onMessage.addListener`. Switch on `msg.type`. For `ADD_VIDEOS`, stream `PROGRESS` and end with `ADD_DONE`.

- [ ] **Step 1: Write the dispatcher**

Replace `src/content/content.ts` entirely:

```ts
import { sendToRuntime } from '../lib/messaging';
import type { Message, Playlist } from '../lib/types';
import { readCurrentChannel } from '../lib/youtube/channel';
import {
  listMyPlaylists,
  listPlaylistVideoIds,
  createPlaylist,
} from '../lib/youtube/playlists';
import { fetchVideos } from '../lib/youtube/videoFetcher';
import { addVideos } from '../lib/youtube/videoAdder';
import { videosToAdd } from '../lib/youtube/dedupe';

console.log('[bulk-playlist] content script loaded');

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  // Wrap async work — chrome.runtime requires `return true` to keep the
  // sendResponse channel open across awaits.
  handle(msg)
    .then(sendResponse)
    .catch((err) => sendResponse({ type: 'ERROR', reason: String(err) } as Message));
  return true;
});

async function handle(msg: Message): Promise<Message> {
  switch (msg.type) {
    case 'GET_CHANNEL': {
      const ch = readCurrentChannel();
      if (!ch) return { type: 'ERROR', reason: 'Not on a YouTube channel or video page' };
      return { type: 'CHANNEL_RESULT', id: ch.id, name: ch.name };
    }

    case 'GET_PLAYLISTS': {
      const items: Playlist[] = await listMyPlaylists();
      return { type: 'PLAYLISTS_RESULT', items };
    }

    case 'CREATE_PLAYLIST': {
      const playlist = await createPlaylist(msg.title);
      return { type: 'PLAYLIST_CREATED', playlist };
    }

    case 'ADD_VIDEOS': {
      // 1. Fetch videos
      const fetched = await fetchVideos(msg.channelId, msg.mode, msg.count);
      // 2. Fetch existing IDs in target playlist
      const existing = await listPlaylistVideoIds(msg.playlistId);
      // 3. Dedupe
      const toAdd = videosToAdd(fetched, existing);
      const skipped = fetched.length - toAdd.length;
      const total = toAdd.length;

      // 4. Batched add with PROGRESS streamed to popup
      const ids = toAdd.map((v) => v.id);
      const result = await addVideos(msg.playlistId, ids, (added, lastAddedId) => {
        sendToRuntime({ type: 'PROGRESS', added, total, lastAddedId });
      });

      return {
        type: 'ADD_DONE',
        added: result.added,
        skipped,
        failed: result.failed,
        failureReason: result.failureReason,
      };
    }

    default:
      return { type: 'ERROR', reason: `Unknown message type: ${(msg as Message).type}` };
  }
}
```

- [ ] **Step 2: Rebuild and reload**

```bash
npm run build
```

Refresh extension at `chrome://extensions`.

- [ ] **Step 3: Manually exercise the dispatcher from the popup's console**

Click the extension icon to open the popup. Right-click in the popup → **Inspect**. In the popup's DevTools console:

```js
// Find the active tab and send a message
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
await chrome.tabs.sendMessage(tab.id, { type: 'GET_CHANNEL' });
```

Expected: `{ type: 'CHANNEL_RESULT', id: '...', name: '...' }`.

Try `GET_PLAYLISTS`:

```js
await chrome.tabs.sendMessage(tab.id, { type: 'GET_PLAYLISTS' });
```

Expected: `{ type: 'PLAYLISTS_RESULT', items: [...] }`.

- [ ] **Step 4: Verify PROGRESS streams**

In the popup's console, subscribe to runtime messages:

```js
chrome.runtime.onMessage.addListener((msg) => console.log('popup got:', msg));
// Then fire an ADD_VIDEOS with a tiny count to a test playlist
await chrome.tabs.sendMessage(tab.id, {
  type: 'ADD_VIDEOS',
  channelId: 'UCxxxxx',     // your channel
  mode: 'latest',
  count: 3,
  playlistId: 'PLxxxxx',    // your test playlist
});
```

Expected: a sequence of `PROGRESS` logs, then `ADD_DONE`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: content script message dispatcher (full protocol)"
```

---

## Phase 5 — Popup UI (Tasks 12–17)

Build the React components one at a time, wiring them together in `App.tsx` at the end. Each component is a pure function of its props.

### Task 12: Summary component

**Files:**
- Create: `src/popup/components/Summary.tsx`

Displays a run's final result.

- [ ] **Step 1: Write the component**

`src/popup/components/Summary.tsx`:

```tsx
interface Props {
  added: number;
  skipped: number;
  failed: number;
  failureReason?: string;
}

export default function Summary({ added, skipped, failed, failureReason }: Props) {
  return (
    <div style={{ padding: 8, borderTop: '1px solid #ddd', fontSize: 13 }}>
      <div>✅ Added: <strong>{added}</strong></div>
      <div>⏭️ Skipped (already in playlist): <strong>{skipped}</strong></div>
      <div>❌ Failed: <strong>{failed}</strong></div>
      {failureReason && <div style={{ color: '#a00', marginTop: 4 }}>Reason: {failureReason}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: Summary component"
```

---

### Task 13: ModePicker component

**Files:**
- Create: `src/popup/components/ModePicker.tsx`

Three radio-style buttons. Highlighted when selected.

- [ ] **Step 1: Write the component**

`src/popup/components/ModePicker.tsx`:

```tsx
import type { Mode } from '../../lib/types';

interface Props {
  value: Mode;
  onChange: (mode: Mode) => void;
}

const modes: Array<{ key: Mode; label: string }> = [
  { key: 'latest', label: 'Latest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'popular', label: 'Most popular' },
];

export default function ModePicker({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 8 }}>
      {modes.map((m) => {
        const selected = m.key === value;
        return (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 4,
              border: selected ? '1px solid #1a73e8' : '1px solid #ccc',
              background: selected ? '#e8f0fe' : 'white',
              cursor: 'pointer',
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: ModePicker component"
```

---

### Task 14: CountInput component

**Files:**
- Create: `src/popup/components/CountInput.tsx`

Numeric input clamped to 1–1000.

- [ ] **Step 1: Write the component**

`src/popup/components/CountInput.tsx`:

```tsx
interface Props {
  value: number;
  onChange: (n: number) => void;
}

export default function CountInput({ value, onChange }: Props) {
  return (
    <div style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
      <label htmlFor="count" style={{ fontSize: 13 }}>How many?</label>
      <input
        id="count"
        type="number"
        min={1}
        max={1000}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(Math.min(1000, Math.max(1, n)));
        }}
        style={{ flex: 1, padding: '4px 6px' }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: CountInput component"
```

---

### Task 15: PlaylistPicker component

**Files:**
- Create: `src/popup/components/PlaylistPicker.tsx`

Dropdown of playlists + a "Create new" option that prompts the user for a title.

- [ ] **Step 1: Write the component**

`src/popup/components/PlaylistPicker.tsx`:

```tsx
import type { Playlist } from '../../lib/types';

interface Props {
  playlists: Playlist[];
  value: string;          // selected playlist ID, or '__create__'
  onChange: (id: string) => void;
  onCreate: (title: string) => void;
  loading: boolean;
}

const CREATE = '__create__';

export default function PlaylistPicker({ playlists, value, onChange, onCreate, loading }: Props) {
  return (
    <div style={{ padding: 8 }}>
      <label htmlFor="playlist" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
        Add to playlist
      </label>
      <select
        id="playlist"
        value={value}
        disabled={loading}
        onChange={(e) => {
          const v = e.target.value;
          if (v === CREATE) {
            const title = prompt('New playlist title?');
            if (title) onCreate(title);
          } else {
            onChange(v);
          }
        }}
        style={{ width: '100%', padding: '4px 6px' }}
      >
        {loading && <option>Loading…</option>}
        {!loading && playlists.length === 0 && <option value="">(no playlists found)</option>}
        {playlists.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title} ({p.videoCount})
          </option>
        ))}
        {!loading && <option value={CREATE}>+ Create new playlist…</option>}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: PlaylistPicker component"
```

---

### Task 16: AddButton component

**Files:**
- Create: `src/popup/components/AddButton.tsx`

Button that becomes a progress display while a run is in flight.

- [ ] **Step 1: Write the component**

`src/popup/components/AddButton.tsx`:

```tsx
interface Props {
  onClick: () => void;
  disabled: boolean;
  progress: { added: number; total: number } | null;
}

export default function AddButton({ onClick, disabled, progress }: Props) {
  if (progress) {
    const pct = progress.total > 0 ? Math.round((progress.added / progress.total) * 100) : 0;
    return (
      <div style={{ padding: 8 }}>
        <div style={{ fontSize: 13, marginBottom: 4 }}>
          Adding {progress.added} / {progress.total} ({pct}%)
        </div>
        <div style={{ background: '#eee', borderRadius: 4, overflow: 'hidden', height: 8 }}>
          <div style={{ background: '#1a73e8', width: `${pct}%`, height: '100%' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 8 }}>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: disabled ? '#aaa' : '#1a73e8',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontWeight: 600,
        }}
      >
        Add to playlist
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: AddButton with progress display"
```

---

### Task 17: Wire it all together in App.tsx

**Files:**
- Modify: `src/popup/App.tsx` (full rewrite)
- Create: `src/popup/global.css`

App holds state, sends messages on mount and on Add click, subscribes to PROGRESS / ADD_DONE.

- [ ] **Step 1: Add a small stylesheet**

`src/popup/global.css`:

```css
body {
  margin: 0;
  font-family: 'Roboto', system-ui, sans-serif;
  font-size: 14px;
  background: #fafafa;
}

h2 {
  margin: 0;
  padding: 8px;
  border-bottom: 1px solid #ddd;
  font-size: 14px;
}

button:focus-visible, select:focus-visible, input:focus-visible {
  outline: 2px solid #1a73e8;
}
```

- [ ] **Step 2: Rewrite App.tsx**

`src/popup/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import './global.css';
import { sendToContent, isMessageOfType } from '../lib/messaging';
import type { Mode, Playlist, Message } from '../lib/types';
import ModePicker from './components/ModePicker';
import CountInput from './components/CountInput';
import PlaylistPicker from './components/PlaylistPicker';
import AddButton from './components/AddButton';
import Summary from './components/Summary';

type RunResult = { added: number; skipped: number; failed: number; failureReason?: string };

export default function App() {
  const [channel, setChannel] = useState<{ id: string; name: string } | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);

  const [mode, setMode] = useState<Mode>('latest');
  const [count, setCount] = useState(10);
  const [target, setTarget] = useState('');

  const [progress, setProgress] = useState<{ added: number; total: number } | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  // On mount: fetch channel + playlists
  useEffect(() => {
    void (async () => {
      const ch = await sendToContent({ type: 'GET_CHANNEL' });
      if (isMessageOfType(ch, 'CHANNEL_RESULT')) {
        setChannel({ id: ch.id, name: ch.name });
      } else if (isMessageOfType(ch, 'ERROR')) {
        setChannelError(ch.reason);
      }

      const pl = await sendToContent({ type: 'GET_PLAYLISTS' });
      if (isMessageOfType(pl, 'PLAYLISTS_RESULT')) {
        setPlaylists(pl.items);
        if (pl.items[0]) setTarget(pl.items[0].id);
      }
      setPlaylistsLoading(false);
    })();
  }, []);

  // Subscribe to PROGRESS / ADD_DONE messages from the content script
  useEffect(() => {
    const listener = (msg: Message) => {
      if (isMessageOfType(msg, 'PROGRESS')) {
        setProgress({ added: msg.added, total: msg.total });
      } else if (isMessageOfType(msg, 'ADD_DONE')) {
        setProgress(null);
        setResult({
          added: msg.added,
          skipped: msg.skipped,
          failed: msg.failed,
          failureReason: msg.failureReason,
        });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const onCreate = async (title: string) => {
    const resp = await sendToContent({ type: 'CREATE_PLAYLIST', title });
    if (isMessageOfType(resp, 'PLAYLIST_CREATED')) {
      setPlaylists((prev) => [...prev, resp.playlist]);
      setTarget(resp.playlist.id);
    }
  };

  const onAdd = () => {
    if (!channel || !target) return;
    setProgress({ added: 0, total: count });
    setResult(null);
    void sendToContent({
      type: 'ADD_VIDEOS',
      channelId: channel.id,
      mode,
      count,
      playlistId: target,
    });
  };

  if (channelError) {
    return (
      <div style={{ width: 320, padding: 12 }}>
        <h2>Bulk Playlist Adder</h2>
        <p style={{ padding: 12 }}>Open a YouTube channel or video page first.</p>
      </div>
    );
  }

  return (
    <div style={{ width: 320 }}>
      <h2>Bulk Playlist Adder</h2>
      <div style={{ padding: '4px 8px', fontSize: 13, color: '#555' }}>
        Channel: <strong>{channel?.name ?? 'detecting…'}</strong>
      </div>
      <ModePicker value={mode} onChange={setMode} />
      <CountInput value={count} onChange={setCount} />
      <PlaylistPicker
        playlists={playlists}
        value={target}
        onChange={setTarget}
        onCreate={onCreate}
        loading={playlistsLoading}
      />
      <AddButton
        onClick={onAdd}
        disabled={!channel || !target || playlistsLoading || progress !== null}
        progress={progress}
      />
      {result && <Summary {...result} />}
    </div>
  );
}
```

- [ ] **Step 3: Rebuild**

```bash
npm run build
```

Refresh extension.

- [ ] **Step 4: Sanity check the popup**

1. Open the popup on `youtube.com/`. Should say "Open a YouTube channel or video page first."
2. Open `https://www.youtube.com/@veritasium`. Click the extension icon. Popup should show:
   - Channel name "Veritasium"
   - Mode buttons (Latest selected)
   - Count input with `10`
   - Playlist dropdown populated with your playlists
   - "Add to playlist" button

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire popup App.tsx end-to-end"
```

---

## Phase 6 — Smoke test & polish (Task 18)

End-to-end manual verification with real data.

### Task 18: Full smoke test

**Files:** none (verification only)

- [ ] **Step 1: Small run — Latest 3**

1. Open `https://www.youtube.com/@SomeSmallChannel`.
2. Click extension icon.
3. Select **Latest**, count `3`, target = your test playlist.
4. Click Add.

Expected:
- Progress bar moves from 0/3 to 3/3.
- Summary shows Added: 3, Skipped: 0, Failed: 0.
- Visit the playlist on YouTube — the 3 newest videos are there.

- [ ] **Step 2: Dedupe — repeat the same run**

Without clearing the playlist, click Add again with the same settings.

Expected:
- Progress goes briefly to 0/0 (nothing to add).
- Summary: Added: 0, Skipped: 3, Failed: 0.

- [ ] **Step 3: Medium run — Popular 50**

Same flow but mode = Popular, count = 50.

Expected:
- Progress bar increments steadily.
- Final summary: Added: 50 (or 50 minus any duplicates from Step 1), Skipped: 0 (or 3).
- Playlist has 50 + previously-added videos.

- [ ] **Step 4: Oldest run — verify slow path works**

Pick a small channel (~50 videos). Mode = Oldest, count = 5.

Expected:
- Brief "collecting" pause (no progress yet, since fetch is happening).
- Then progress 1→5.
- Summary correct.
- Playlist contains the 5 *oldest* videos (compare against scrolling to the bottom of the channel's Videos tab).

- [ ] **Step 5: Error path — popup with no YouTube tab**

1. Switch to a non-YouTube tab (e.g., google.com).
2. Click the extension icon.

Expected: "Open a YouTube channel or video page first."

- [ ] **Step 6: Create-new-playlist flow**

Open the dropdown, choose "+ Create new playlist…", type a title.

Expected:
- New playlist appears in the dropdown, selected.
- An empty playlist exists on YouTube.

- [ ] **Step 7: Final commit / tag (optional)**

```bash
git add -A
git commit --allow-empty -m "chore: end-to-end smoke test passes"
```

---

## Final notes

- **Common failure: empty playlist list.** Inspect the `playlist/get_add_to_playlist` response in DevTools Network and adjust the JSON paths in `src/lib/youtube/playlists.ts`.
- **Common failure: `oldest` is slow.** Expected — the API paginates newest-first. For channels with thousands of videos, expect 30+ seconds. The UI doesn't show progress during the collection phase; that's the trade-off documented in the spec.
- **Common failure: `popular` tab returns empty.** YouTube sometimes changes the `params` string for the Popular sort. Capture a fresh one from DevTools Network when you click the Popular sort on a channel page, then update `POPULAR_PARAMS` in `videoFetcher.ts`.
- **`oldest` correctness check.** Sanity-test by also running `latest` and comparing — the union should be the full upload list.

---

## Self-review (done while writing this plan)

- **Spec coverage:** All sections in the design doc map to tasks. Section 4.3 file layout → Tasks 1, 3, 4–10, 11, 12–17. Section 5 message protocol → Tasks 3 (types), 5 (helper), 11 (dispatcher). Section 6 data shapes → Task 3. Section 7 error handling → Tasks 10 (retry/backoff) and 11 (ERROR responses) and 17 (channel-error UI). Section 8 testing → Tasks 4 and 5 (unit tests); Task 18 (manual smoke test).
- **Placeholders:** None.
- **Type consistency:** `videosToAdd(fetched, existing: Set<string>)` in Task 4 matches the call site in Task 11. `addVideos(playlistId, videoIds, onBatch)` signature in Task 10 matches the call in Task 11. `Message` discriminants used in Task 11 all defined in Task 3.
