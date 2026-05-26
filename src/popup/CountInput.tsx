interface CountInputProps {
    value: number;
    onChange: (n: number) => void;
}

export default function CountInput({ value, onChange } : CountInputProps) {
    return (
        <label>Number of videos:
            <input
                type='number'
                min={1}
                max={1000}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
            />
        </label>
    )
}