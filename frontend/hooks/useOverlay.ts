"use client";

import { useEffect, useState } from "react";

/**
 * Keeps an overlay mounted while its exit animation plays.
 * `mounted` drives rendering, `closing` swaps in the exit animation.
 */
export function usePresence(open: boolean, exitMs = 220) {
    const [mounted, setMounted] = useState(open);

    // Mount immediately on open (state adjusted during render, not in an effect).
    if (open && !mounted) setMounted(true);

    const closing = mounted && !open;

    useEffect(() => {
        if (!closing) return;

        const timer = setTimeout(() => setMounted(false), exitMs);
        return () => clearTimeout(timer);
    }, [closing, exitMs]);

    return { mounted, closing };
}

let lockCount = 0;

/** Locks page scroll while any overlay is open; safe to nest. */
export function useScrollLock(active: boolean) {
    useEffect(() => {
        if (!active) return;

        lockCount += 1;
        const { body } = document;
        if (lockCount === 1) body.style.overflow = "hidden";

        return () => {
            lockCount -= 1;
            if (lockCount === 0) body.style.overflow = "";
        };
    }, [active]);
}

export function useEscape(active: boolean, onEscape?: () => void) {
    useEffect(() => {
        if (!active || !onEscape) return;

        const handler = (event: KeyboardEvent) => {
            if (event.key === "Escape") onEscape();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [active, onEscape]);
}

/**
 * Returns the last non-null value, so an overlay keeps showing its content
 * while it animates out after the source state was cleared.
 */
export function useRetained<T>(value: T | null): T | null {
    const [retained, setRetained] = useState(value);

    if (value !== null && value !== retained) setRetained(value);

    return value ?? retained;
}
