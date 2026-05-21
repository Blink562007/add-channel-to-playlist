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