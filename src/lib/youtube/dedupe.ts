import type { Video } from '../types';

export function videosToAdd(fetched: Video[], existing: Set<string>): Video[] {
    const existingCopy = new Set<string>(existing);
    const arr: Video[] = [];

    for (const video of fetched) {
        if (existingCopy.has(video.id)) continue; 
        arr.push(video);
        existingCopy.add(video.id);
    }

    return arr;
}