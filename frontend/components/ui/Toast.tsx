"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastVariant = "success" | "error" | "info";

type ToastAction = {
    label: string;
    onClick: () => void;
    destructive?: boolean;
};

type ToastItem = {
    id: number;
    message: string;
    variant: ToastVariant;
    action?: ToastAction;
    leaving: boolean;
};

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((listener) => listener());
}

function dismiss(id: number) {
    items = items.map((item) => (item.id === id ? { ...item, leaving: true } : item));
    emit();
    setTimeout(() => {
        items = items.filter((item) => item.id !== id);
        emit();
    }, 180);
}

function show(
    message: string,
    variant: ToastVariant = "info",
    duration = 3200,
    action?: ToastAction
) {
    const id = nextId++;
    // Cap the stack so a burst of errors can't cover the screen.
    items = [...items.slice(-2), { id, message, variant, action, leaving: false }];
    emit();
    setTimeout(() => dismiss(id), duration);
}

export const toast = Object.assign(show, {
    success: (message: string) => show(message, "success"),
    error: (message: string) => show(message, "error", 4200),
    info: (message: string) => show(message, "info"),
    // Gives the user time to read the prompt and reach the button.
    action: (message: string, action: ToastAction) => show(message, "info", 5000, action),
});

const icons = { success: CheckCircle2, error: XCircle, info: Info };
const tones = {
    success: "text-sp-success",
    error: "text-sp-danger",
    info: "text-sp-primary",
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
const getSnapshot = () => items;
const emptySnapshot: ToastItem[] = [];

export function Toaster() {
    const toasts = useSyncExternalStore(subscribe, getSnapshot, () => emptySnapshot);

    return (
        <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 top-0 z-(--z-toast) flex flex-col items-center gap-2 px-4 pt-[calc(var(--safe-top)+0.75rem)]"
        >
            {toasts.map((item) => {
                const Icon = icons[item.variant];
                return (
                    <div
                        key={item.id}
                        role={item.variant === "error" ? "alert" : "status"}
                        className={cn(
                            "pointer-events-auto flex w-full max-w-sm items-center rounded-sp-md border border-sp-border",
                            "bg-sp-surface/90 text-sm text-sp-text shadow-sp-float backdrop-blur-md",
                            item.leaving ? "animate-fade-out" : "animate-toast-in"
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => dismiss(item.id)}
                            className="flex flex-1 items-center gap-3 px-4 py-3 text-left"
                        >
                            <Icon size={18} className={cn("shrink-0", tones[item.variant])} />
                            <span className="flex-1">{item.message}</span>
                        </button>

                        {item.action && (
                            <button
                                type="button"
                                onClick={() => {
                                    dismiss(item.id);
                                    item.action?.onClick();
                                }}
                                className={cn(
                                    "mr-2 shrink-0 rounded-sp-sm px-3 py-1.5 font-semibold transition active:scale-95",
                                    item.action.destructive
                                        ? "text-sp-danger hover:bg-sp-danger/10"
                                        : "text-sp-primary hover:bg-sp-primary/10"
                                )}
                            >
                                {item.action.label}
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
