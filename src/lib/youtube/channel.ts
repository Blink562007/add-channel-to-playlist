interface YtInitialData {
    metadata?: { channelMetadataRenderer?: { externalId?: string; title?: string } };
    header?: { c4TabbedHeaderRenderer?: { channelId?: string; title?: string } };
}

export function readCurrentChannel(): { id: string; name: string } | null {
    const channelLink = document.querySelector('ytd-channel-name a[href*="/channel/"]') as HTMLAnchorElement | null;
    if (channelLink) {
        const match = channelLink.href.match(/\/channel\/(UC[^/?#]+)/);
        const id = match?.[1];
        const name = channelLink.textContent?.trim();
        if (id && name) return { id, name };
    } 
    const data = (window as unknown as { ytInitialData?: YtInitialData }).ytInitialData;
    const meta = data?.metadata?.channelMetadataRenderer;

    if (meta?.externalId && meta.title) {
        return {id: meta.externalId, name: meta.title};
    }

    const header = data?.header?.c4TabbedHeaderRenderer;
    if (header?.channelId && header?.title) {
        return {id: header.channelId, name: header.title};
    }

    const player = (window as unknown as {
        ytInitialPlayerResponse?: { videoDetails?: { channelId?: string; author?: string } };
    }).ytInitialPlayerResponse;

    if (player?.videoDetails?.channelId && player?.videoDetails?.author) {
        return { id: player.videoDetails.channelId, name: player.videoDetails.author };
    }

    const metaTag = document.querySelector('meta[itemprop="channelId"]') as HTMLMetaElement | null;
    const titleTag = document.querySelector('link[itemprop="name"]') as HTMLLinkElement | null;

    if (metaTag?.content) {
        return { id: metaTag.content, name: titleTag?.getAttribute("title") ?? 'Unknown channel' };
    }

    return null;
}