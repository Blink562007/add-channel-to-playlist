interface SummaryProps {
    channelName: string | null;
}

export default function Summary({ channelName }: SummaryProps) {
    return channelName
        ? <p className="summary">Adding from <strong>{channelName}</strong></p>
        : <p className="summary muted">Loading channel…</p>;
}