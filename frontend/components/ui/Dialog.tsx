"use client";

import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useEscape, usePresence, useScrollLock } from "@/hooks/useOverlay";

type DialogProps = {
    open: boolean;
    onClose?: () => void;
    title: string;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    children?: React.ReactNode;
};

export default function Dialog({ open, onClose, title, description, actions, children }: DialogProps) {
    const { mounted, closing } = usePresence(open, 150);

    useScrollLock(mounted);
    useEscape(open, onClose);

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-(--z-dialog) grid place-items-center p-6">
            <div
                aria-hidden
                onClick={onClose}
                className={cn("absolute inset-0 bg-black/60", closing ? "animate-fade-out" : "animate-fade-in")}
            />
            <div
                role="alertdialog"
                aria-modal="true"
                aria-label={title}
                className={cn(
                    "relative w-full max-w-sm rounded-sp-lg border border-sp-border bg-sp-card p-6 shadow-sp-float",
                    closing ? "animate-pop-out" : "animate-pop-in"
                )}
            >
                <h2 className="text-lg font-semibold text-sp-text">{title}</h2>
                {description && <div className="mt-2 text-sm text-sp-muted">{description}</div>}
                {children}
                {actions && <div className="mt-6 flex gap-3 [&>*]:flex-1">{actions}</div>}
            </div>
        </div>,
        document.body
    );
}
