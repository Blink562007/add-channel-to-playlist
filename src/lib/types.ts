export type Mode = 'latest' | 'oldest' | 'popular';

export interface Video {
    id: string;
    title: string;
    channelId: string;
    durationSec?: number;
    viewCount?: number;
}

export interface Playlist {
    id: string;
    title: string;
    videoCount?: number;
}

export type Message =
    | { type: 'GET_CHANNEL' }
    | { type: 'CHANNEL_RESULT'; id: string; name: string }
    | { type: 'GET_PLAYLISTS' }
    | { type: 'PLAYLISTS_RESULT'; items: Playlist[] }
    | { type: 'CREATE_PLAYLIST'; title: string }
    | { type: 'PLAYLIST_CREATED'; playlist: Playlist }
    | { type: 'ADD_VIDEOS'; channelId: string; mode: Mode; count: number; playlistId: string }
    | { type: 'PROGRESS'; added: number; total: number; lastAddedId: string }
    | { type: 'ADD_DONE'; added: number; skipped: number; failed: number; failureReason?: string }
    | { type: 'ERROR'; reason: string };

export type MessageOf<T extends Message['type']> = Extract<Message, { type: T }>;