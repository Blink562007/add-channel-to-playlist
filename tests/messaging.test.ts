import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendToContent } from '../src/lib/messaging';

beforeEach(() => {

    globalThis.chrome = {
        tabs: {
            query: vi.fn().mockResolvedValue([{ id: 42 }]), 
            sendMessage: vi.fn().mockResolvedValue({type: 'CHANNEL_RESULT', id: 'C', name: 'Channel Name'}),
        },
    } as unknown as typeof chrome;
    
});

describe('sendToContent', () => {

    it('queries the active tab and sends the message there', async () => {
        const result = await sendToContent({ type: 'GET_CHANNEL' });
        expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, { type: 'GET_CHANNEL' });
        expect(result).toEqual({ type: 'CHANNEL_RESULT', id: 'C', name: 'Channel Name' });
    });

    it('throws if no active tab is found', async () => {
        chrome.tabs.query = vi.fn().mockResolvedValue([]);
        await expect(sendToContent({ type: 'GET_CHANNEL' })).rejects.toThrow('No active tab found');
    });
});