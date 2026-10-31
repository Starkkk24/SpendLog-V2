"use client";

import { useEffect, useState } from "react";

/** True once the window has scrolled past `threshold` px. */
export function useScrolled(threshold = 4) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const update = () => setScrolled(window.scrollY > threshold);
        update();
        window.addEventListener("scroll", update, { passive: true });
        return () => window.removeEventListener("scroll", update);
    }, [threshold]);

    return scrolled;
}

/** True while the user is scrolling down; resets when they scroll up. */
export function useScrollingDown(tolerance = 8) {
    const [down, setDown] = useState(false);

    useEffect(() => {
        let last = window.scrollY;

        const update = () => {
            const y = window.scrollY;
            if (Math.abs(y - last) < tolerance) return;
            setDown(y > last && y > 40);
            last = y;
        };
        window.addEventListener("scroll", update, { passive: true });
        return () => window.removeEventListener("scroll", update);
    }, [tolerance]);

    return down;
}
