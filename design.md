## Design Practice 1

### Extension
- **App** — UI for the pop-up
  - `global.css` — background, fonts, shared styles
  - `index.html` — entry point for app
  - `App.tsx` top-level popup component, depends on `messaging.ts` and `types.ts`
  -  **components/**
    - `playlist_adder_mode.tsx` — 3 buttons: most popular / latest / oldest
    - `filter.tsx` — number of videos + min-view-count filter
    - `show_playlists.tsx` — creates a dropdown of playlists
    - `add.tsx` — add button + spinner (depends on `messaging.ts`)
    - `summary.tsx` — summary of added / already-exists / failed

### content
  - `content.ts` - handles the incoming message type and calls youtube functions, posting the result back. Uses `messaging.ts` and `types.ts`
### lib
- **youtube/**
  - `channel.ts` — finds channel id + name from current page GET_CHANNEL -> CHANNEL_RESULTS
  - `playlist_getter.ts` — fetches account's playlists GET_PLAYLISTS -> PLAYLIST_RESULTS
  - `create_new_playlist.ts` - creates a new playlist
  - `video_getter.ts` - fetches the filtered videos that are to be added, GET_VIDEO -> VIDEO_RESULTS
  - `video_adder.ts` — adds the videos from content.ts to the playlist, while filtering the duplicates. Sends progress back to popup. ADD_VIDEO_TO_PLAYLIS {playlist_id, video_id} -> many PROGRESS {added, total} -> ADD_DONE {added, skipped, failed}
    - `duplicate_validation.ts` — checks if video already in playlist
- `messaging.ts` - Sends messages of the right type.
- `types.ts` - Ensures that the data types of the messages being sent are correct and defines shared data types by popup and content.