interface SummaryProps {
    channelName: string | null;
}

export default function Summary({ channelName }: SummaryProps) {
    return channelName
        ? <p>Adding from: {channelName}</p>
        : <p>Loading channel…</p>;
}