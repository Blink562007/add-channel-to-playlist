import { innertubeFetch } from './innertube';

export async function readCurrentChannel(): Promise<{ id: string; name: string } | null> {
    const path = location.pathname;
    const name = document.title.replace(/ - YouTube$/, '').trim();

    // /channel/UC… — id is right there in the live URL
    const direct = path.match(/^\/channel\/(UC[^/?#]+)/);
    if (direct) return { id: direct[1], name };

    // /@handle, /c/…, /user/… — the id isn't in the URL, and canonical lags on
    // SPA nav, so ask YouTube to resolve the live URL to a channel id.
    if (path.startsWith('/@') || path.startsWith('/c/') || path.startsWith('/user/')) {
        const res = await innertubeFetch<{
            endpoint?: { browseEndpoint?: { browseId?: string } };
        }>('navigation/resolve_url', { url: location.href });
        const id = res.endpoint?.browseEndpoint?.browseId;
        if (id?.startsWith('UC')) return { id, name };
    }

    return null;   // not a channel page (watch, home, search, …)
}
