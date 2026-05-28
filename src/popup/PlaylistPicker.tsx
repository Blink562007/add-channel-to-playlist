import { useState } from "react"
import type { Playlist } from "../lib/types"

interface PlaylistPickerProps {
    playlists: Playlist[]; 
    value: string;
    onChange: (id: string) => void;
    onCreate: (title: string) => void;
}

export default function PlaylistPicker({ playlists, value, onChange, onCreate }: PlaylistPickerProps) {
    const [newTitle, setNewTitle] = useState('');
    
    return (
        <div className="playlist-picker">
            <select value={value} onChange={(e) => onChange(e.target.value)}>
                <option value="" disabled>Select a playlist</option>
                {playlists.map((pl) => (
                    <option key={pl.id} value={pl.id}>{pl.title}</option>
                ))}
            </select>

            <div className="or-divider"><span>or</span></div>

            <div className="create-new">
                <input
                    type="text"
                    placeholder="New playlist name"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                />
                <button
                    disabled={!newTitle.trim()}
                    onClick={() => { onCreate(newTitle); setNewTitle(''); }}
                >
                    Create
                </button>
            </div>
        </div>
    );

}