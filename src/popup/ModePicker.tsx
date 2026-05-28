import type { Mode } from '../lib/types';

// Props = the inputs a component receives from its parent.
// This component is "controlled": it doesn't own the selected value,
// the parent does. We receive the current value + a way to report changes.
interface ModePickerProps {
    value: Mode;                    // which mode is currently selected
    onChange: (mode: Mode) => void; // call this when the user picks a different one
}

const MODES: Mode[] = ['latest', 'oldest', 'popular'];

export default function ModePicker({ value, onChange }: ModePickerProps) {
    return (
        <div className="mode-picker">
            {MODES.map((mode) => (
                <label key={mode}>
                    <input
                        type="radio"
                        name="mode"
                        checked={value === mode}
                        onChange={() => onChange(mode)}
                    />
                    <span>{mode}</span>
                </label>
            ))}
        </div>
    );
}
