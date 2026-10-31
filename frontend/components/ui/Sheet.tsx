"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useEscape, usePresence, useScrollLock } from "@/hooks/useOverlay";

type SheetProps = {
    open: boolean;
    onClose?: () => void;
    title?: string;
    className?: string;
    children: React.ReactNode;
};

/** Bottom sheet on phones, centred panel from `sm` up. */
export default function Sheet({ open, onClose, title, className, children }: SheetProps) {
    const { mounted, closing } = usePresence(open);
    const panelRef = useRef<HTMLDivElement>(null);

    useScrollLock(mounted);
    useEscape(open, onClose);

    useEffect(() => {
        if (open) panelRef.current?.focus({ preventScroll: true });
    }, [open]);

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-(--z-sheet) flex items-end justify-center sm:items-center sm:p-6">
            <div
                aria-hidden
                onClick={onClose}
                className={cn(
                    "absolute inset-0 bg-black/55 backdrop-blur-[2px]",
                    closing ? "animate-fade-out" : "animate-fade-in"
                )}
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                className={cn(
                    "relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden outline-none",
                    "rounded-t-sp-sheet border border-b-0 border-sp-border bg-sp-bg shadow-sp-float sm:rounded-sp-sheet sm:border-b",
                    closing ? "animate-sheet-out sm:animate-pop-out" : "animate-sheet-in sm:animate-pop-in",
                    className
                )}
            >
                <div className="flex shrink-0 justify-center pt-2.5 pb-1 sm:hidden">
                    <span className="h-1.5 w-10 rounded-full bg-white/20" />
                </div>
                {title && (
                    <h2 className="shrink-0 px-5 pt-2 pb-3 text-lg font-semibold text-sp-text">{title}</h2>
                )}
                <div className="scroll-area flex-1 pb-safe">{children}</div>
            </div>
        </div>,
        document.body
    );
}
