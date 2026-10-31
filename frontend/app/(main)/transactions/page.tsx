"use client";

import FAB from "@/components/ui/FAB";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Sheet from "@/components/ui/Sheet";
import { ListSkeleton } from "@/components/ui/Skeleton";
import PageHeader from "@/components/navigation/PageHeader";
import { cn } from "@/lib/cn";
import { ArrowUpDown, Check, ChevronRight, ReceiptText, RotateCw, WifiOff } from "lucide-react";
import CreateTransactionModal from "@/components/transactions/CreateTransactionModal";

// import { useEffect, useState } from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTransactions } from "@/services/transactions";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

// const queryClient = useQueryClient();

type Split = {
    id: number;
    user: number | null;
    contact: number | null;
    amount: string;
};

type Transaction = {
    id: number;
    payer_user: number | null;
    payer_contact: number | null;
    total_amount: string;
    note: string;
    transaction_datetime: string;
    splits: Split[];
};


export default function TransactionsPage() {
    const queryClient = useQueryClient();

    const {
        data: transactions = [],
        isPending: loading,
        isError,
        error,
        refetch: loadTransactions,
    } = useQuery<Transaction[]>({
        queryKey: ["transactions"],
        queryFn: getTransactions,
    });


    const router = useRouter();
    const [showCreateTransaction, setShowCreateTransaction] =
        useState(false);

    const [sortBy, setSortBy] = useState<
        "newest" | "oldest" | "high" | "low"
    >("newest");

    if (isError) {
        console.error("Failed to load transactions:", error);

        return (
            <main className="page">
                <PageHeader title="Transactions" />
                <EmptyState
                    icon={WifiOff}
                    title="Failed to load transactions"
                    description="Please check your connection and try again."
                    action={
                        <Button variant="secondary" onClick={() => loadTransactions()}>
                            <RotateCw size={16} />
                            Retry
                        </Button>
                    }
                />
            </main>
        );
    }

    const sortedTransactions = [...transactions].sort((a, b) => {
        if (sortBy === "newest") {
            return (
                new Date(b.transaction_datetime).getTime() -
                new Date(a.transaction_datetime).getTime()
            );
        }

        if (sortBy === "oldest") {
            return (
                new Date(a.transaction_datetime).getTime() -
                new Date(b.transaction_datetime).getTime()
            );
        }

        if (sortBy === "high") {
            return Number(b.total_amount) - Number(a.total_amount);
        }

        return Number(a.total_amount) - Number(b.total_amount);
    });

    const [showSort, setShowSort] = useState(false);

    // async function loadTransactions() {
    //     try {
    //         const data = await getTransactions();
    //         setTransactions(data);
    //     } catch (error) {
    //         console.error("Failed to load transactions:", error);
    //     } finally {
    //         setLoading(false);
    //     }
    // }

    // useEffect(() => {
    //     loadTransactions();
    // }, []);

    if (loading) {
        return (
            <main className="page">
                <PageHeader title="Transactions" subtitle="Your spending history" />
                <ListSkeleton rows={8} />
            </main>
        );
    }

    // Consecutive transactions that share a day label render as one card.
    const groups: { day: string; items: { transaction: Transaction; time: string }[] }[] = [];

    sortedTransactions.forEach((transaction, index) => {
        const currentDate = new Date(
            transaction.transaction_datetime
        );

        const previousDate =
            index > 0
                ? new Date(
                    sortedTransactions[index - 1]
                        .transaction_datetime
                )
                : null;

        const currentDay = currentDate.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
            }
        );

        const previousDay = previousDate
            ? previousDate.toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                }
            )
            : null;

        const showDate =
            index === 0 || currentDay !== previousDay;

        const time = currentDate.toLocaleTimeString(
            "en-IN",
            {
                hour: "numeric",
                minute: "2-digit",
            }
        );

        if (showDate) groups.push({ day: currentDay, items: [] });
        groups[groups.length - 1].items.push({ transaction, time });
    });

    let rowIndex = 0;

    return (
        <main className="page">
            <PageHeader
                title="Transactions"
                subtitle="Your spending history"
                actions={
                    transactions.length > 0 && (
                        <Button variant="secondary" size="sm" onClick={() => setShowSort(true)}>
                            <ArrowUpDown size={15} />
                            Sort
                        </Button>
                    )
                }
            />

            {transactions.length === 0 ? (
                <EmptyState
                    icon={ReceiptText}
                    title="No transactions yet"
                    description="Create your first transaction to start building your SpendLog."
                />
            ) : (
                <div className="space-y-5">
                    {groups.map((group) => (
                        <section key={`${group.day}-${group.items[0].transaction.id}`}>
                            <h2 className="sticky-under-header -mx-4 bg-sp-bg/95 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-sp-muted backdrop-blur">
                                {group.day}
                            </h2>

                            <div className="divide-y divide-sp-border overflow-hidden rounded-sp-lg border border-sp-border bg-sp-card">
                                {group.items.map(({ transaction, time }) => (
                                    <button
                                        key={transaction.id}
                                        type="button"
                                        onClick={() =>
                                            router.push(
                                                `/transactions/${transaction.id}`
                                            )
                                        }
                                        style={{ animationDelay: `${Math.min(rowIndex++, 10) * 30}ms` }}
                                        className="flex w-full animate-rise-in items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
                                    >
                                        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-sp-primary/20 text-sm font-semibold text-sp-primary-soft">
                                            ₹
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[15px] font-medium text-sp-text">
                                                {transaction.note ||
                                                    "Untitled transaction"}
                                            </p>

                                            <p className="mt-0.5 text-xs text-sp-muted">
                                                {time} ·{" "}
                                                {transaction.splits.length}{" "}
                                                participant
                                                {transaction.splits.length !==
                                                    1
                                                    ? "s"
                                                    : ""}
                                            </p>
                                        </div>

                                        <p className="tabular shrink-0 text-[15px] font-semibold text-sp-text">
                                            ₹
                                            {Number(
                                                transaction.total_amount
                                            ).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}
                                        </p>

                                        <ChevronRight size={16} className="-mr-1 shrink-0 text-sp-muted/60" />
                                    </button>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}

            {showCreateTransaction && (
                <CreateTransactionModal
                    onClose={() => setShowCreateTransaction(false)}
                    onCreated={() => {
                        // Refresh in the background so the modal can close as
                        // soon as the POST succeeds instead of waiting for the
                        // list refetch.
                        void Promise.all([
                            queryClient.invalidateQueries({ queryKey: ["transactions"] }),
                            queryClient.invalidateQueries({ queryKey: ["profileBalance"] }),
                            queryClient.invalidateQueries({ queryKey: ["contactBalance"] }),
                        ]).catch((error) => {
                            console.error("Failed to refresh transaction data:", error);
                        });
                    }}
                />
            )}
            <FAB
                label="Create transaction"
                onClick={() => setShowCreateTransaction(true)}
            />

            <Sheet open={showSort} onClose={() => setShowSort(false)} title="Sort by">
                <div className="space-y-1 px-3 pb-4">
                    {[
                        ["newest", "Newest first"],
                        ["oldest", "Oldest first"],
                        ["high", "Amount: high → low"],
                        ["low", "Amount: low → high"],
                    ].map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => {
                                setSortBy(
                                    value as
                                    | "newest"
                                    | "oldest"
                                    | "high"
                                    | "low"
                                );
                                setShowSort(false);
                            }}
                            className={cn(
                                "flex h-12 w-full items-center justify-between rounded-sp-md px-4 text-[15px] transition-colors active:scale-[0.99]",
                                sortBy === value
                                    ? "bg-sp-primary/15 font-medium text-sp-text"
                                    : "text-sp-muted hover:bg-white/5 hover:text-sp-text"
                            )}
                        >
                            {label}

                            {sortBy === value && <Check size={18} className="text-sp-primary" />}
                        </button>
                    ))}
                </div>
            </Sheet>
        </main>
    );
}
