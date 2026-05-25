import {Message} from '../lib/types';
import { innertubeFetch } from '../lib/youtube/innertube';
import { readCurrentChannel } from '../lib/youtube/channel';
import { listMyPlaylists, listPlaylistVideoIds, createPlaylist } from '../lib/youtube/playlists';
import { fetchChannelVideos } from '../lib/youtube/videoFetcher';
import { addVideosToPlaylist } from '../lib/youtube/videoAdder';
console.log('[bulk-playlist] content script loaded');
(window as unknown as { bulkPlaylistDebug: unknown }).bulkPlaylistDebug = { 
    innertubeFetch, 
    readCurrentChannel, 
    listMyPlaylists,
    listPlaylistVideoIds,
    createPlaylist,
    fetchChannelVideos,
    addVideosToPlaylist,
};

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    (async () => {
        try {
            switch (msg.type) {
                case 'GET_CHANNEL': {
                    const ch = await readCurrentChannel();
                    sendResponse({ type: 'CHANNEL_RESULT', id: ch?.id, name: ch?.name})
                    break;
                }
                case 'GET_PLAYLISTS' : {
                    const items = await listMyPlaylists();
                    sendResponse({ type: 'PLAYLISTS_RESULT', items });
                    break;
                } case 'CREATE_PLAYLIST': {
                    const new_playlist = await createPlaylist(msg.title);
                    sendResponse( {type: 'PLAYLIST_CREATED', playlist: new_playlist});
                    break;
                } 
                case 'ADD_VIDEOS': {
                    const videos = await fetchChannelVideos(msg.channelId, msg.mode, msg.count);
                    const { added, failed } = await addVideosToPlaylist(msg.playlistId, videos);
                    sendResponse( {type: 'ADD_DONE', added: added, skipped: 0, failed: failed });
                    break;
                }
                default:
                    sendResponse({ type: 'ERROR', reason: `Unknown message: ${(msg as any).type}` });
            } 
        } catch (e) {
            sendResponse({ type: 'ERROR', reason: (e as Error).message });
        }
    })();
    return true; // keeps the channel open for async sendResponse
});

