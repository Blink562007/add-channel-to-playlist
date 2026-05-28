interface SummaryProps {
    channelName: string | null;
}

export default function Summary({ channelName }: SummaryProps) {
    return (
        channelName ? <p className="summary">Adding from: {channelName}</p> : <p className="summary">Loading channel…</p>
    )
}