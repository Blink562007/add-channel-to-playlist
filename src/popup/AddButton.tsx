interface AddButtonProps {
    disabled: boolean;
    onClick: () => void;
}

export default function AddButton({ disabled, onClick }: AddButtonProps) {
    return (
        <button className="add-btn" onClick={onClick} disabled={disabled}>
            Add to playlist
        </button>
    );
}