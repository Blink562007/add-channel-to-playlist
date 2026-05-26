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
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend>Sort</legend>
            {MODES.map((mode) => (
                <label key={mode} style={{ display: 'block' }}>
                    <input
                        type="radio"
                        name="mode"
                        checked={value === mode}
                        onChange={() => onChange(mode)}
                    />
                    {mode}
                </label>
            ))}
        </fieldset>
    );
}
