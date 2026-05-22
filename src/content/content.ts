import { innertubeFetch } from '../lib/youtube/innertube';
console.log('[bulk-playlist] content script loaded');
(window as unknown as { bulkPlaylistDebug: unknown }).bulkPlaylistDebug = { innertubeFetch };