import { innertubeFetch } from "./innertube";
import type { Video } from "../types";
import { listPlaylistVideoIds } from "./playlists";
import { videosToAdd } from "./dedupe";

const BATCH = 10;

export async function addVideosToPlaylist(
    playlistId: string,
    videos: Video[],
): Promise<{ added: number; skipped: number; failed: number }> {

    const existingIds = await listPlaylistVideoIds(playlistId);
    const toAdd = videosToAdd(videos, existingIds);
    const skipped = videos.length - toAdd.length;

    let added = 0, failed = 0;
    for (let i = 0; i < toAdd.length; i += BATCH) {
        const chunk = toAdd.slice(i, i + BATCH);
        const actions = chunk.map(video => ({action: 'ACTION_ADD_VIDEO', addedVideoId: video.id}));
        const resp = await innertubeFetch<any>('browse/edit_playlist', {playlistId, actions});

        const results = resp.playlistEditResults ?? [];
        const addedInBatch = results.filter(
            (r: any) => r.playlistEditVideoAddedResultData?.videoId,
        ).length;
        added += addedInBatch;
        failed += chunk.length - addedInBatch;
        
    }
    return {added: added, skipped: skipped, failed: failed};
}