import type { Message } from '../lib/types';

// The ISOLATED-world bridge. It has chrome.runtime (the MAIN worker doesn't),
// so the popup talks to this script, and this script relays to the MAIN
// worker via window.postMessage — and relays the reply back.

console.log('[bulk-playlist] bridge loaded');

const ORIGIN_SELF = window.location.origin;

// Each in-flight request gets a unique id so we can match the async reply
// back to the correct popup caller's sendResponse.
let nextId = 0;
const pending = new Map<number, (res: Message) => void>();

// Replies coming back from the MAIN worker.
window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window) return;
    const data = e.data;
    if (data?.__bulkPlaylist !== 'response') return;

    const resolve = pending.get(data.id);
    if (resolve) {
        pending.delete(data.id);
        resolve(data.payload as Message);
    }
});

// Requests coming from the popup.
chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    const id = nextId++;
    pending.set(id, sendResponse);
    window.postMessage({ __bulkPlaylist: 'request', id, payload: msg }, ORIGIN_SELF);
    return true; // keep the channel open — sendResponse fires once the reply returns
});
