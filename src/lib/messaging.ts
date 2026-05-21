import type { Message } from './types';

export async function sendToContent(msg: Message): Promise<Message> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
        throw new Error('No active tab found');
    } else {
        return chrome.tabs.sendMessage(tab.id, msg);
    }
}

export function sendToRuntime(msg: Message): void {
    chrome.runtime.sendMessage(msg).catch(() => {});
}

export function isMessageOfType<T extends Message['type']>(
msg: unknown,
type: T,
): msg is Extract<Message, { type: T }> {
    if (typeof msg !== 'object') return false;
    if (msg === null) return false;
    if ((msg as Message).type !== type) return false;

    return true;
}