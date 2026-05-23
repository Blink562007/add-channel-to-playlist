import { innertubeFetch } from '../lib/youtube/innertube';
import { readCurrentChannel } from '../lib/youtube/channel';
console.log('[bulk-playlist] content script loaded');
(window as unknown as { bulkPlaylistDebug: unknown }).bulkPlaylistDebug = { innertubeFetch, readCurrentChannel };

