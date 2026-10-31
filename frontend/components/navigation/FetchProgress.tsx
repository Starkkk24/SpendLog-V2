"use client";

import { useEffect, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { cn } from "@/lib/cn";

/** Slim top bar for background refetches; waits briefly so cache hits don't flash it. */
export default function FetchProgress() {
    const fetching = useIsFetching() > 0;
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setVisible(fetching), fetching ? 250 : 0);
        return () => clearTimeout(timer);
    }, [fetching]);

    return (
        <div
            aria-hidden
            className={cn(
                "pointer-events-none fixed inset-x-0 top-0 z-(--z-toast) h-0.5 overflow-hidden transition-opacity duration-(--dur-base)",
                visible ? "opacity-100" : "opacity-0"
            )}
        >
            <div className="h-full w-1/3 animate-[progress_1.1s_var(--ease-out)_infinite] bg-sp-primary" />
        </div>
    );
}
