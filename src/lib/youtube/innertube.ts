interface Ytcfg {
INNERTUBE_API_KEY: string;
INNERTUBE_CLIENT_NAME: string;
INNERTUBE_CLIENT_VERSION: string;
HL?: string;
GL?: string;
}

const ORIGIN = 'https://www.youtube.com';

function readYtcfg(): Ytcfg {
    const cfg = (window as unknown as { ytcfg?: { data_?: Ytcfg } }).ytcfg?.data_;
    if (!cfg) {
        throw new Error("ytcfg not found; are we on youtube.com?")
    } 
    return cfg;
}

function readSapisid(): string {
    const cookies: string[] = document.cookie.split('; ');
    for (const cookie of cookies) {
        if (cookie.trim().startsWith('SAPISID=')) {
            return cookie.split('=')[1];
        }
    }

    throw new Error("SAPISID cookie missing; are you signed in?");
}

async function sapisidhash(): Promise<string> {
    const ts = Math.floor(Date.now() / 1000);
    const input = `${ts} ${readSapisid()} ${ORIGIN}`;
    const buf = new TextEncoder().encode(input);
    const hashBuf = await crypto.subtle.digest('SHA-1', buf);
    const hex = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `${ts}_${hex}`;
}

export async function innertubeFetch<TResponse = unknown>(
endpoint: string,
payload: Record<string, unknown>,
): Promise<TResponse> {
    const cfg = readYtcfg();
    const body = {
        context: {
            client: {
                clientName: cfg.INNERTUBE_CLIENT_NAME,
                clientVersion: cfg.INNERTUBE_CLIENT_VERSION,
                hl: cfg.HL ?? 'en',
                gl: cfg.GL ?? 'US'
            },
        },
        ...payload,
    };
    const url = `${ORIGIN}/youtubei/v1/${endpoint}?key=${cfg.INNERTUBE_API_KEY}&prettyPrint=false`;

    const resp = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `SAPISIDHASH ${await sapisidhash()}`,
        'X-Origin': ORIGIN,
        'X-Goog-AuthUser': '0',
    },
    body: JSON.stringify(body),
    });

    if (!resp.ok) {
        throw new Error(`Innertube API error: ${resp.status} ${resp.statusText}`);
    }

    return resp.json() as Promise<TResponse>;
}