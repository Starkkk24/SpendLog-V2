"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useScrollingDown } from "@/hooks/useScrolled";

type FABProps = {
    label: string;
    onClick: () => void;
};

export default function FAB({ label, onClick }: FABProps) {
    // Extended (icon + label) at rest, collapses to an icon while scrolling down.
    const collapsed = useScrollingDown();

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
                "fixed right-4 z-(--z-fab) flex h-14 items-center overflow-hidden rounded-sp-lg bg-sp-primary text-white shadow-sp-float",
                "bottom-[calc(var(--nav-h)+var(--safe-bottom)+1rem)] sm:right-[max(1.5rem,calc(50vw-20rem))]",
                "transition-[width,transform,filter] duration-(--dur-slow) ease-(--ease-out) hover:brightness-110 active:scale-95",
                collapsed ? "w-14" : "w-auto"
            )}
        >
            <span className="grid size-14 shrink-0 place-items-center">
                <Plus size={26} strokeWidth={2.5} />
            </span>
            <span
                className={cn(
                    "whitespace-nowrap pr-5 text-[15px] font-semibold transition-opacity duration-(--dur-base)",
                    collapsed ? "w-0 pr-0 opacity-0" : "opacity-100"
                )}
            >
                {label}
            </span>
        </button>
    );
}
