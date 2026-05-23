import { innertubeFetch } from './innertube';
import type { Playlist } from '../types';

export async function listMyPlaylists(): Promise<Playlist[]> {
    const resp = await innertubeFetch<{
    contents?: Array<{
        addToPlaylistRenderer?: {
        playlists?: Array<{
            playlistAddToOptionRenderer: {
            playlistId: string;
            title: { simpleText: string };
            };
        }>;
        };
    }>;
    }>('playlist/get_add_to_playlist', { videoIds: ['dQw4w9WgXcQ'] });

    const playlists: Playlist[] = [];

    const items = resp.contents?.[0]?.addToPlaylistRenderer?.playlists ?? [];
    for (const item of items) {
        const r = item.playlistAddToOptionRenderer;
        if (!r?.playlistId || !r?.title?.simpleText) continue;
        playlists.push({ id: r.playlistId, title: r.title.simpleText});
    }

    return playlists;
}

export async function listPlaylistVideoIds(playlistId: string): Promise<Set<string>> {
    const ids = new Set<string>();
    const browseId = `VL${playlistId}`;
    let continuation: string | undefined;
        
    for (let page = 0; page < 50; page++) {
        const payload = continuation ? { continuation } : { browseId };
        const resp = await innertubeFetch<any>('browse', payload);

        // Items live in one of two places depending on whether it's the first
        // page or a continuation page.
        const items: any[] =
        resp.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
            ?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer
            ?.contents?.[0]?.playlistVideoListRenderer?.contents ??
        resp.onResponseReceivedActions?.[0]?.appendContinuationItemsAction
            ?.continuationItems ??
        [];

        let nextCont: string | undefined;
        for (const item of items) {
            const videoId = item.playlistVideoRenderer?.videoId;
            if (videoId) ids.add(videoId);

            const token = item.continuationItemRenderer?.continuationEndpoint
                ?.continuationCommand?.token; 
            if (token) nextCont = token;
        }

        if (!nextCont) break;
        continuation = nextCont;
    }

    return ids;
}

export async function createPlaylist(title: string): Promise<Playlist> {
    const resp = await innertubeFetch<any>('playlist/create', { title, privacyStatus: 'PRIVATE' });
    if (!resp.playlistId) {
        throw new Error('Unexpected response from playlist/create: ' + JSON.stringify(resp));
    }

    return { id: resp.playlistId, title, videoCount: 0 };
}