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
    const [loading, setLoading] = useState(false);

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
        if (!channelId || !playlistId) return;
        if (count < 1 || count > 1000) {
            setStatus('Please enter a number between 1 and 1000.');
            return;
        }
        setStatus('Adding');
        setLoading(true);
        const res = await sendToContent({type: 'ADD_VIDEOS', channelId, mode, count, playlistId})
        setLoading(false);
        if (res.type === 'ADD_DONE') {
            setStatus(`Added ${res.added}`);
        } else if (res.type === 'ERROR') {
            setStatus(`Error: ${res.reason}`);
        }
    }


    return (
        <div className="app">
            <Summary channelName={channelName} />

            <section className="card">
                <h2>What to add</h2>
                <ModePicker value={mode} onChange={setMode} />
                <CountInput value={count} onChange={setCount} />
            </section>

            <section className="card">
                <h2>Destination</h2>
                <PlaylistPicker
                    playlists={playlists}
                    value={playlistId}
                    onChange={setPlaylistId}
                    onCreate={handleCreate}
                />
            </section>

            <AddButton
                disabled={!channelId || !playlistId}
                onClick={handleAdd}
            />
            {status && <p className={`status${loading ? ' loading' : ''}`}>{status}</p>}
        </div>
    )
}