import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addVideosToPlaylist } from '../src/lib/youtube/videoAdder';
import { innertubeFetch } from '../src/lib/youtube/innertube';
import type { Video } from '../src/lib/types';

// Replace the real innertube module with auto-mocks, so no real
// network call ever happens during the test.
vi.mock('../src/lib/youtube/innertube');

// Helper: build N fake videos with predictable ids: v0, v1, v2, ...
function makeVideos(n: number): Video[] {
    return Array.from({ length: n }, (_, i) => ({ id: `v${i}`, title: `t${i}` }));
}

beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: echo back one "success" result per action sent,
    // so the counting logic in addVideosToPlaylist sees a full success.
    vi.mocked(innertubeFetch).mockImplementation(async (_ep: string, body: any) => ({
        playlistEditResults: body.actions.map((a: any) => ({
            playlistEditVideoAddedResultData: { videoId: a.addedVideoId },
        })),
    }) as any);
});

describe('addVideosToPlaylist chunking', () => {
    it('makes no calls for an empty list', async () => {
        const result = await addVideosToPlaylist('PL123', makeVideos(0));
        expect(vi.mocked(innertubeFetch)).toHaveBeenCalledTimes(0);
        expect(result).toEqual({ added: 0, failed: 0 });
    });

    it('sends one batch of 10 for exactly 10 videos', async () => {
        await addVideosToPlaylist('PL123', makeVideos(10));
        const calls = vi.mocked(innertubeFetch).mock.calls;
        expect(calls).toHaveLength(1);
        expect(calls[0][1].actions).toHaveLength(10);
    });

    it('splits 11 videos into batches of 10 and 1', async () => {
        await addVideosToPlaylist('PL123', makeVideos(11));
        const calls = vi.mocked(innertubeFetch).mock.calls;
        expect(calls).toHaveLength(2);
        expect(calls[0][1].actions).toHaveLength(10);
        expect(calls[1][1].actions).toHaveLength(1);
    });

    it('splits 25 videos into 10 / 10 / 5', async () => {
        await addVideosToPlaylist('PL123', makeVideos(25));
        const calls = vi.mocked(innertubeFetch).mock.calls;
        expect(calls.map(c => (c[1] as any).actions.length)).toEqual([10, 10, 5]);
    });

    it('counts added correctly across batches', async () => {
        const result = await addVideosToPlaylist('PL123', makeVideos(25));
        expect(result).toEqual({ added: 25, failed: 0 });
    });
});
