"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getBalance } from "@/services/balance";
import { settleSplit } from "@/services/transactions";

interface Transaction {
    id: number;
    split_id: number;
    amount: number;
    date: string;
    paid_by: string;
    note: string;
}

interface BalanceData {
    contact_id: number;
    contact_name: string;
    balance: number;
    transactions: Transaction[];
}

export default function ContactProfilePage() {
    const params = useParams();
    const router = useRouter();

    const contactId = Number(params.id);

    const [data, setData] = useState<BalanceData | null>(null);
    const [showSettled, setShowSettled] = useState(false);

    const [loading, setLoading] = useState(true);

    const [sortBy, setSortBy] = useState<
        "newest" | "oldest" | "high" | "low"
    >("newest");

    const [showSort, setShowSort] = useState(false);

    async function loadBalance() {
        try {
            const response = await getBalance(contactId, showSettled);

            setData({
                ...response,
                balance: Number(response.balance),
                transactions: response.transactions.map(
                    (transaction: Transaction) => ({
                        ...transaction,
                        amount: Number(transaction.amount),
                    })
                ),
            });
        } catch (error) {
            console.error("Failed to load balance:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadBalance();
    }, [contactId, showSettled]);

    async function handleSettle(splitId: number) {
        try {
            await settleSplit(splitId);
            await loadBalance();
        } catch (error) {
            console.error("Failed to settle split:", error);
        }
    }
    const sortedTransactions = [...(data?.transactions ?? [])].sort(
        (a, b) => {
            if (sortBy === "newest") {
                return (
                    new Date(b.date).getTime() -
                    new Date(a.date).getTime()
                );
            }

            if (sortBy === "oldest") {
                return (
                    new Date(a.date).getTime() -
                    new Date(b.date).getTime()
                );
            }

            if (sortBy === "high") {
                return Number(b.amount) - Number(a.amount);
            }

            return Number(a.amount) - Number(b.amount);
        }
    );

    return (
        <main className="min-h-screen bg-sp-bg px-4 pb-24 pt-6 text-white sm:px-6">
            <div className="mx-auto max-w-3xl">

                {/* Back */}
                <button
                    onClick={() => router.back()}
                    className="text-sm font-medium text-sp-muted transition hover:text-white"
                >
                    ← Contacts
                </button>

                {loading ? (
                    <p className="mt-8 text-sm text-sp-muted">
                        Loading...
                    </p>
                ) : data === null ? (
                    <p className="mt-8 text-sm text-red-400">
                        Failed to load contact.
                    </p>
                ) : (
                    <>
                        {/* Contact Header */}
                        <div className="mt-8">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sp-primary-deep text-lg font-semibold text-white">
                                    {data.contact_name
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>

                                <div>
                                    <h1 className="text-2xl font-semibold text-white">
                                        {data.contact_name}
                                    </h1>

                                    <p className="mt-1 text-sm text-sp-muted">
                                        Contact balance
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Balance Summary */}
                        <div className="mt-8 border-y border-white/5 py-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-sp-muted">
                                Net Balance
                            </p>

                            {data.balance > 0 ? (
                                <>
                                    <p className="mt-2 text-3xl font-semibold tabular-nums text-sp-success">
                                        +₹
                                        {data.balance.toLocaleString(
                                            "en-IN",
                                            {
                                                minimumFractionDigits: 2,
                                            }
                                        )}
                                    </p>

                                    <p className="mt-1 text-sm text-sp-muted">
                                        {data.contact_name} owes you
                                    </p>
                                </>
                            ) : data.balance < 0 ? (
                                <>
                                    <p className="mt-2 text-3xl font-semibold tabular-nums text-red-400">
                                        -₹
                                        {Math.abs(
                                            data.balance
                                        ).toLocaleString("en-IN", {
                                            minimumFractionDigits: 2,
                                        })}
                                    </p>

                                    <p className="mt-1 text-sm text-sp-muted">
                                        You owe {data.contact_name}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
                                        ₹0.00
                                    </p>

                                    <p className="mt-1 text-sm text-sp-muted">
                                        Settled
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Transaction History */}
                        <div className="mt-8">

                            {/* Header + Toggle */}
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wider text-sp-muted">
                                    Transactions
                                </p>

                                <div className="flex items-center gap-2">
                                    <div className="flex w-fit rounded-xl bg-sp-surface p-1">
                                        <button
                                            onClick={() => setShowSettled(false)}
                                            className={`rounded-lg px-4 py-2 text-xs font-medium transition ${!showSettled
                                                ? "bg-sp-primary text-white"
                                                : "text-sp-muted hover:text-white"
                                                }`}
                                        >
                                            Unsettled
                                        </button>

                                        <button
                                            onClick={() => setShowSettled(true)}
                                            className={`rounded-lg px-4 py-2 text-xs font-medium transition ${showSettled
                                                ? "bg-sp-primary text-white"
                                                : "text-sp-muted hover:text-white"
                                                }`}
                                        >
                                            Settled
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowSort(true)}
                                        className="rounded-xl bg-sp-surface px-3 py-2 text-xs font-medium text-sp-muted transition hover:text-white"
                                    >
                                        Sort
                                    </button>
                                </div>
                            </div>

                            {data.transactions.length === 0 ? (
                                <p className="mt-6 text-sm text-sp-muted">
                                    No transactions with this contact.
                                </p>
                            ) : (
                                <div className="mt-4">

                                    {sortedTransactions.map(
                                        (transaction, index) => {
                                            const currentDate =
                                                new Date(
                                                    transaction.date
                                                );

                                            const previousDate =
                                                index > 0
                                                    ? new Date(
                                                        sortedTransactions[
                                                            index - 1
                                                        ].date
                                                    )
                                                    : null;

                                            const currentDay =
                                                currentDate.toLocaleDateString(
                                                    "en-IN",
                                                    {
                                                        day: "2-digit",
                                                        month: "short",
                                                    }
                                                );

                                            const previousDay =
                                                previousDate
                                                    ? previousDate.toLocaleDateString(
                                                        "en-IN",
                                                        {
                                                            day: "2-digit",
                                                            month: "short",
                                                        }
                                                    )
                                                    : null;

                                            const showDate =
                                                index === 0 ||
                                                currentDay !==
                                                previousDay;

                                            const time =
                                                currentDate.toLocaleTimeString(
                                                    "en-IN",
                                                    {
                                                        hour: "numeric",
                                                        minute: "2-digit",
                                                    }
                                                );

                                            return (
                                                <div
                                                    key={
                                                        transaction.split_id
                                                    }
                                                >
                                                    {showDate && (
                                                        <div className="mb-3 mt-6 first:mt-0">
                                                            <p className="text-xs font-semibold uppercase tracking-wider text-sp-muted">
                                                                {
                                                                    currentDay
                                                                }
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-3 border-b border-white/5 py-4">

                                                        {/* Transaction */}
                                                        <Link
                                                            href={`/transactions/${transaction.id}`}
                                                            className="min-w-0 flex-1"
                                                        >
                                                            <p className="truncate text-sm font-medium text-white">
                                                                {transaction.note ||
                                                                    "Untitled transaction"}
                                                            </p>

                                                            <p className="mt-1 text-xs text-sp-muted">
                                                                {time} ·{" "}
                                                                {
                                                                    transaction.paid_by
                                                                }
                                                            </p>
                                                        </Link>

                                                        {/* Amount + Action */}
                                                        <div className="flex shrink-0 items-center gap-3">
                                                            <p
                                                                className={`text-sm font-semibold tabular-nums ${transaction.amount >
                                                                    0
                                                                    ? "text-sp-success"
                                                                    : transaction.amount <
                                                                        0
                                                                        ? "text-red-400"
                                                                        : "text-white"
                                                                    }`}
                                                            >
                                                                {transaction.amount >
                                                                    0
                                                                    ? "+"
                                                                    : transaction.amount <
                                                                        0
                                                                        ? "-"
                                                                        : ""}
                                                                ₹
                                                                {Math.abs(
                                                                    transaction.amount
                                                                ).toLocaleString(
                                                                    "en-IN",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                    }
                                                                )}
                                                            </p>

                                                            <button
                                                                onClick={() =>
                                                                    handleSettle(
                                                                        transaction.split_id
                                                                    )
                                                                }
                                                                className={`rounded-xl px-3 py-2 text-xs font-medium transition ${showSettled
                                                                    ? "bg-yellow-600 hover:bg-yellow-500"
                                                                    : "bg-sp-primary hover:bg-sp-primary-deep"
                                                                    }`}
                                                            >
                                                                {showSettled
                                                                    ? "UNSETTLE"
                                                                    : "SETTLE"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )}

                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
            {showSort && (
                <div className="fixed inset-0 z-[100] bg-black/50">
                    <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-sp-bg p-5 shadow-2xl">
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">
                                Sort
                            </h2>

                            <button
                                type="button"
                                onClick={() => setShowSort(false)}
                                className="text-sp-muted transition hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-2">
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
                                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition ${sortBy === value
                                            ? "bg-sp-primary text-white"
                                            : "bg-sp-surface text-sp-muted hover:text-white"
                                        }`}
                                >
                                    <span>{label}</span>

                                    {sortBy === value && (
                                        <span>✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}