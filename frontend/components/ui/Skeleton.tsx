"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            aria-hidden
            className={cn(
                "animate-shimmer rounded-sp-sm bg-[length:200%_100%]",
                "bg-[linear-gradient(90deg,var(--sp-card)_0%,var(--sp-surface)_50%,var(--sp-card)_100%)]",
                className
            )}
        />
    );
}

/**
 * Renders nothing for the first `delay` ms so fast cache hits never flash a
 * skeleton; only genuinely slow loads show one.
 */
export function DelayedSkeleton({ delay = 150, children }: { delay?: number; children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    return visible ? <div role="status" aria-label="Loading">{children}</div> : null;
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
    return (
        <DelayedSkeleton>
            <div className="divide-y divide-sp-border overflow-hidden rounded-sp-lg border border-sp-border bg-sp-card">
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                        <Skeleton className="size-10 shrink-0 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-3.5 w-2/5" />
                            <Skeleton className="h-3 w-1/4" />
                        </div>
                        <Skeleton className="h-4 w-16" />
                    </div>
                ))}
            </div>
        </DelayedSkeleton>
    );
}

export function CardSkeleton() {
    return (
        <DelayedSkeleton>
            <div className="space-y-3 rounded-sp-lg border border-sp-border bg-sp-card p-5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
            </div>
        </DelayedSkeleton>
    );
}
