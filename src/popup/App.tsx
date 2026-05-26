import type { Mode, Playlist } from '../lib/types';
import { useState, useEffect} from 'react';
import ModePicker from './ModePicker';
import PlaylistPicker from './PlaylistPicker';
import Summary from './Summary';
import CountInput from './CountInput';
import AddButton from './AddButton';
import { sendToContent } from '../lib/messaging';



export default function App() {
    const [mode, setMode] = useState<Mode>('latest');
    const [count, setCount] = useState(50);
    const [playlistId, setPlaylistId] = useState('');
    const [channelName, setChannelName] = useState<string | null>(null);
    const [channelId, setChannelId] = useState<string | null>(null);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [status, setStatus] = useState<string>('');

    useEffect(() => {
        (async () => {
            const ch = await sendToContent({ type: 'GET_CHANNEL' });
            if (ch.type === 'CHANNEL_RESULT') {
                setChannelName(ch.name);
                setChannelId(ch.id);
            }

            const pls = await sendToContent({ type: 'GET_PLAYLISTS'} )
            if (pls.type === 'PLAYLISTS_RESULT') {
                setPlaylists(pls.items);
            }
        })();
    }, []);

    const handleCreate = async (title: string) => {
        const res = await sendToContent({type: 'CREATE_PLAYLIST', title});
        if (res.type === 'PLAYLIST_CREATED') {
            setPlaylists([...playlists, res.playlist]);
            setPlaylistId(res.playlist.id);
        } else if (res.type === 'ERROR') {
            setStatus(`Error: ${res.reason}`);
        }
    };

    const handleAdd = async () => {
        if (!channelId || !count || !playlistId) return;
        setStatus('Adding...');
        const res = await sendToContent({type: 'ADD_VIDEOS', channelId, mode, count, playlistId})
        if (res.type === 'ADD_DONE') {
            setStatus(`Added ${res.added}`);
        } else if (res.type === 'ERROR') {
            setStatus(`Error: ${res.reason}`);
        }
    }


    return (
        <div style={{ fontFamily: 'sans-serif', padding: 20, maxWidth: 400 }}>
            <h1>YouTube Bulk Playlist Editor</h1>
            <Summary channelName={channelName} />
            <ModePicker value={mode} onChange = {setMode} />
            <CountInput value={count} onChange = {setCount} />
            <PlaylistPicker 
                playlists = {playlists}
                value = {playlistId}
                onChange = {setPlaylistId}
                onCreate = {handleCreate}
            />
            <AddButton 
                disabled = {!channelId || !playlistId || count < 1 || count > 1000}
                onClick={handleAdd}
            />
            {status && <p>{status}</p>}
        </div>
    )
}