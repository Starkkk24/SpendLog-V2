"use client";

import Link from "next/link";
import { ChevronRight, PartyPopper } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Segmented from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";

export type ContactBalance = {
    id: number;
    name: string;
    /** Net remaining amount; positive means the contact owes the user. */
    balance: number;
    open_count: number;
};

export type BalanceFilter = "all" | "lent" | "borrowed";

const emptyStates: Record<BalanceFilter, { title: string; description: string }> = {
    all: {
        title: "All settled up",
        description: "No pending settlements with anyone.",
    },
    lent: {
        title: "Nobody owes you",
        description: "Contacts who owe you money will show up here.",
    },
    borrowed: {
        title: "You don't owe anyone",
        description: "Contacts you owe money to will show up here.",
    },
};

type ContactBalanceListProps = {
    contacts: ContactBalance[];
    filter: BalanceFilter;
    onFilterChange: (filter: BalanceFilter) => void;
};

export default function ContactBalanceList({
    contacts,
    filter,
    onFilterChange,
}: ContactBalanceListProps) {
    const lent = contacts.filter((contact) => contact.balance > 0);
    const borrowed = contacts.filter((contact) => contact.balance < 0);
    const shown = filter === "lent" ? lent : filter === "borrowed" ? borrowed : contacts;

    return (
        <div className="space-y-3">
            <Segmented
                value={filter}
                options={[
                    ["all", `All (${contacts.length})`],
                    ["lent", `Lent (${lent.length})`],
                    ["borrowed", `Borrowed (${borrowed.length})`],
                ] as const}
                onChange={onFilterChange}
            />

            {shown.length === 0 ? (
                <Card>
                    <EmptyState icon={PartyPopper} {...emptyStates[filter]} />
                </Card>
            ) : (
                <Card className="divide-y divide-sp-border overflow-hidden">
                    {shown.map((contact) => (
                        <Link
                            key={contact.id}
                            href={`/contacts/${contact.id}`}
                            className="flex items-center gap-3 py-3.5 pr-3 pl-4 transition-colors hover:bg-white/[0.03] active:opacity-70"
                        >
                            <Avatar name={contact.name} />

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-medium text-sp-text">
                                    {contact.name}
                                </p>
                                <p className="text-xs text-sp-muted">
                                    {contact.open_count} pending
                                    {contact.open_count === 1 ? " item" : " items"}
                                </p>
                            </div>

                            <div className="shrink-0 text-right">
                                <p
                                    className={cn(
                                        "tabular text-[15px] font-semibold",
                                        contact.balance > 0 ? "text-sp-success" : "text-sp-danger"
                                    )}
                                >
                                    ₹{Math.abs(contact.balance).toFixed(2)}
                                </p>
                                <p className="text-xs text-sp-muted">
                                    {contact.balance > 0 ? "owes you" : "you owe"}
                                </p>
                            </div>

                            <ChevronRight size={18} className="shrink-0 text-sp-muted" />
                        </Link>
                    ))}
                </Card>
            )}
        </div>
    );
}
