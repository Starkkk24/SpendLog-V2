"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { useScrolled } from "@/hooks/useScrolled";

type PageHeaderProps = {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    onBack?: () => void;
    actions?: React.ReactNode;
    className?: string;
};

/** Sticky page header that gains a blurred backdrop once content scrolls under it. */
export default function PageHeader({ title, subtitle, onBack, actions, className }: PageHeaderProps) {
    const scrolled = useScrolled();

    return (
        <header
            className={cn(
                "sticky top-0 z-(--z-header) -mx-4 mb-4 px-4 pt-safe transition-[background-color,border-color,backdrop-filter] duration-(--dur-base)",
                "border-b",
                scrolled ? "border-sp-border bg-sp-bg/80 backdrop-blur-xl" : "border-transparent bg-sp-bg",
                className
            )}
        >
            <div className={cn("flex items-center gap-2 py-2", scrolled ? "h-(--header-h)" : "min-h-(--header-h)")}>
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Go back"
                        className="-ml-2 grid size-10 shrink-0 place-items-center rounded-full text-sp-text transition hover:bg-white/5 active:scale-90"
                    >
                        <ChevronLeft size={24} />
                    </button>
                )}
                <div className="min-w-0 flex-1">
                    <h1
                        className={cn(
                            "truncate font-semibold tracking-tight text-sp-text transition-[font-size] duration-(--dur-base)",
                            scrolled || onBack ? "text-lg" : "text-2xl"
                        )}
                    >
                        {title}
                    </h1>
                    {subtitle && !scrolled && (
                        <p className="animate-fade-in truncate text-sm text-sp-muted">{subtitle}</p>
                    )}
                </div>
                {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
            </div>
        </header>
    );
}
