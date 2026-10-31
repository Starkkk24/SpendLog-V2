"use client";

import { cn } from "@/lib/cn";

type SegmentedProps<T extends string> = {
    value: T;
    options: readonly (readonly [T, string])[];
    onChange: (value: T) => void;
    className?: string;
};

/** Pill toggle with a sliding indicator. */
export default function Segmented<T extends string>({ value, options, onChange, className }: SegmentedProps<T>) {
    const index = options.findIndex(([option]) => option === value);

    return (
        <div className={cn("relative flex rounded-sp-md bg-sp-card p-1 ring-1 ring-sp-border", className)}>
            <span
                aria-hidden
                className="absolute top-1 bottom-1 left-1 rounded-sp-sm bg-sp-primary shadow-sp-card transition-transform duration-(--dur-slow) ease-(--ease-out)"
                style={{
                    width: `calc((100% - 0.5rem) / ${options.length})`,
                    transform: `translateX(${index * 100}%)`,
                }}
            />
            {options.map(([option, label]) => (
                <button
                    key={option}
                    type="button"
                    onClick={() => onChange(option)}
                    aria-pressed={option === value}
                    className={cn(
                        "relative h-9 flex-1 rounded-sp-sm px-3 text-sm font-medium transition-colors duration-(--dur-base)",
                        option === value ? "text-white" : "text-sp-muted hover:text-sp-text"
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
