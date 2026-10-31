"use client";

import Link from "next/link";
import { Users, Receipt, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export default function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        {
            label: "Contacts",
            href: "/contacts",
            icon: Users,
        },
        {
            label: "Transactions",
            href: "/transactions",
            icon: Receipt,
        },
        {
            label: "Profile",
            href: "/profile",
            icon: User,
        },
    ];

    const activeIndex = navItems.findIndex((item) => pathname.startsWith(item.href));

    return (
        <nav className="fixed inset-x-0 bottom-0 z-(--z-nav) border-t border-sp-border bg-sp-bg/80 pb-safe backdrop-blur-xl backdrop-saturate-150">
            <div className="relative mx-auto flex h-(--nav-h) max-w-lg items-center px-3">
                {/* Sliding pill behind the active tab */}
                {activeIndex >= 0 && (
                    <span
                        aria-hidden
                        className="absolute top-2 bottom-2 left-3 rounded-sp-md bg-sp-primary/15 transition-transform duration-(--dur-slow) ease-(--ease-out)"
                        style={{
                            width: `calc((100% - 1.5rem) / ${navItems.length})`,
                            transform: `translateX(${activeIndex * 100}%)`,
                        }}
                    />
                )}

                {navItems.map((item, index) => {
                    const Icon = item.icon;
                    const active = index === activeIndex;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "relative flex h-full flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                                "transition-colors duration-(--dur-base) active:scale-95",
                                active ? "text-sp-primary" : "text-sp-muted hover:text-sp-text"
                            )}
                        >
                            <Icon
                                size={22}
                                strokeWidth={active ? 2.4 : 1.8}
                                className={cn("transition-transform duration-(--dur-base) ease-(--ease-spring)", active && "-translate-y-px scale-110")}
                            />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
