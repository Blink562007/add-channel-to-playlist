import type { Message } from '../lib/types';
import { readCurrentChannel } from '../lib/youtube/channel';
import { listMyPlaylists, createPlaylist } from '../lib/youtube/playlists';
import { fetchChannelVideos } from '../lib/youtube/videoFetcher';
import { addVideosToPlaylist } from '../lib/youtube/videoAdder';

const ORIGIN_SELF = window.location.origin;

// Runs the actual request and returns the response message.
async function handle(msg: Message): Promise<Message> {
    switch (msg.type) {
        case 'GET_CHANNEL': {
            const ch = await readCurrentChannel();
            return { type: 'CHANNEL_RESULT', id: ch?.id ?? '', name: ch?.name ?? '' };
        }
        case 'GET_PLAYLISTS': {
            const items = await listMyPlaylists();
            return { type: 'PLAYLISTS_RESULT', items };
        }
        case 'CREATE_PLAYLIST': {
            const playlist = await createPlaylist(msg.title);
            return { type: 'PLAYLIST_CREATED', playlist };
        }
        case 'ADD_VIDEOS': {
            const videos = await fetchChannelVideos(msg.channelId, msg.mode, msg.count);
            const { added, failed } = await addVideosToPlaylist(msg.playlistId, videos);
            return { type: 'ADD_DONE', added, skipped: 0, failed };
        }
        default:
            return { type: 'ERROR', reason: `Unknown message: ${(msg as { type: string }).type}` };
    }
}

// Listen for requests relayed from the ISOLATED-world bridge.
window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window) return;                       // ignore cross-frame noise
    const data = e.data;
    if (data?.__bulkPlaylist !== 'request') return;        // only our request envelopes

    (async () => {
        let payload: Message;
        try {
            payload = await handle(data.payload as Message);
        } catch (err) {
            payload = { type: 'ERROR', reason: err instanceof Error ? err.message : String(err) };
        }
        // Reply with the same id so the bridge can match it to the right caller.
        window.postMessage({ __bulkPlaylist: 'response', id: data.id, payload }, ORIGIN_SELF);
    })();
});
