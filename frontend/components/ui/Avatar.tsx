import { cn } from "@/lib/cn";

const tones = [
    "bg-sp-primary/25 text-sp-primary-soft",
    "bg-sp-success/20 text-sp-success",
    "bg-sp-warning/20 text-sp-warning",
    "bg-sp-danger/20 text-sp-danger",
    "bg-white/10 text-sp-text",
];

function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function Avatar({ name, className }: { name: string; className?: string }) {
    // Stable colour per name so the same person always looks the same.
    const tone = tones[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % tones.length];

    return (
        <span
            aria-hidden
            className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold",
                tone,
                className
            )}
        >
            {initials(name)}
        </span>
    );
}
