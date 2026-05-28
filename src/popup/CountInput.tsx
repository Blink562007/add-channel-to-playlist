import { useState, type ChangeEvent } from 'react';

interface CountInputProps {
    value: number;
    onChange: (n: number) => void;
}

export default function CountInput({ value, onChange }: CountInputProps) {
    // Local string state for what's *displayed* in the input. The parent's
    // `value` is always a valid number; this lets the field be momentarily
    // empty without forcing the parent to a meaningless 0.
    const [text, setText] = useState(String(value));

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const t = e.target.value;
        setText(t);                            // always update the visible text
        const n = parseInt(t, 10);
        if (!isNaN(n)) onChange(n);            // only sync valid numbers up
    };

    // If the user left the field empty/invalid, restore the parent's last
    // good number when they tab/click away — so the field never stays blank.
    const handleBlur = () => {
        if (text === '' || isNaN(parseInt(text, 10))) {
            setText(String(value));
        }
    };

    return (
        <label className="count-input">
            <span>Number of videos:</span>
            <input
                type='number'
                min={1}
                max={1000}
                value={text}
                onChange={handleChange}
                onBlur={handleBlur}
            />
        </label>
    );
}
