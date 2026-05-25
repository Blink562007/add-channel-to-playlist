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

