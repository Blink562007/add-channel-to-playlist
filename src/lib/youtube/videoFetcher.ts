import type { Mode, Video } from '../types';
import { innertubeFetch } from './innertube';

const VIDEOS_TAB_PARAMS = 'EgZ2aWRlb3PyBgQKAjoA';

export async function fetchChannelVideos(
    channelId: string,
    mode: Mode,
    limit: number,
): Promise<Video[]> {
    const result: Video[] = [];

    let resp = await innertubeFetch<any>('browse', {
        browseId: channelId,
        params: VIDEOS_TAB_PARAMS,
    });

    if (mode !== 'latest') {
        const target = mode === 'popular' ? 'Popular' : 'Oldest';
        const chips = resp.contents?.twoColumnBrowseResultsRenderer?.tabs
            ?.find((t: any) => t.tabRenderer?.selected)
            ?.tabRenderer?.content?.richGridRenderer?.header
            ?.chipBarViewModel?.chips ?? [];

        let token: string | undefined;
        for (const chip of chips) {
            const cv = chip.chipViewModel;
            if (!cv) continue;

            if (cv.text === target) {
                token = cv.tapCommand?.innertubeCommand?.continuationCommand?.token;
                if (token) break;
            }

            const listItems: any[] = cv.tapCommand?.innertubeCommand?.showSheetCommand
                ?.panelLoadingStrategy?.inlineContent?.sheetViewModel?.content
                ?.listViewModel?.listItems ?? [];
            for (const item of listItems) {
                const liv = item.listItemViewModel;
                if (liv?.title?.content !== target) continue;
                const commands: any[] = liv.rendererContext?.commandContext?.onTap
                    ?.innertubeCommand?.commandExecutorCommand?.commands ?? [];
                for (const cmd of commands) {
                    if (cmd.continuationCommand?.token) {
                        token = cmd.continuationCommand.token;
                        break;
                    }
                }
                if (token) break;
            }
            if (token) break;
        }

        if (!token) throw new Error(`Could not find ${target} chip`);
        resp = await innertubeFetch<any>('browse', { continuation: token });
    }

    while (true) {
        const actions: any[] = resp.onResponseReceivedActions ?? [];
        const bodyReload = actions.find(
            (a: any) => a.reloadContinuationItemsCommand?.slot === 'RELOAD_CONTINUATION_SLOT_BODY',
        )?.reloadContinuationItemsCommand?.continuationItems;
        const append = actions.find(
            (a: any) => a.appendContinuationItemsAction?.continuationItems,
        )?.appendContinuationItemsAction?.continuationItems;

        const items: any[] =
            resp.contents?.twoColumnBrowseResultsRenderer?.tabs
                ?.find((t: any) => t.tabRenderer?.selected)
                ?.tabRenderer?.content?.richGridRenderer?.contents ??
            bodyReload ??
            append ??
            [];

        let nextCont: string | undefined;
        for (const item of items) {
            if (result.length >= limit) return result;

            const lockup = item.richItemRenderer?.content?.lockupViewModel;
            if (lockup?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO' && lockup?.contentId) {
                result.push({
                    id: lockup.contentId,
                    title: lockup.metadata?.lockupMetadataViewModel?.title?.content ?? '',
                });
            }

            const token = item.continuationItemRenderer?.continuationEndpoint
                ?.continuationCommand?.token;
            if (token) nextCont = token;
        }

        if (!nextCont) break;
        resp = await innertubeFetch<any>('browse', { continuation: nextCont });
    }

    if (mode === 'popular' || mode === 'oldest') {
        result.reverse();
    }

    return result;
}
