"use client";

import Link from "next/link";
import { Users, Receipt, User } from "lucide-react";
import { usePathname } from "next/navigation";

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

    return (
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-sp-surface/95 backdrop-blur-md">
            <div className="mx-auto flex h-20 max-w-lg items-center justify-around px-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs transition ${active
                                ? "text-sp-primary"
                                : "text-sp-muted hover:text-white"
                                }`}
                        >
                            <Icon size={22} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}