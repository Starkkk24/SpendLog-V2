"use client";

import FAB from "@/components/ui/FAB";
import CreateTransactionModal from "@/components/transactions/CreateTransactionModal";

import { useEffect, useState } from "react";
import { getTransactions } from "@/services/transactions";
import { useRouter } from "next/navigation";

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
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const [showCreateTransaction, setShowCreateTransaction] =
        useState(false);

    async function loadTransactions() {
        try {
            const data = await getTransactions();
            setTransactions(data);
        } catch (error) {
            console.error("Failed to load transactions:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadTransactions();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50">
                <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
                    <p className="text-sm text-slate-500">
                        Loading transactions...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-sp-bg px-4 pb-24 pt-6 text-white sm:px-6">
            <div className="mx-auto max-w-5xl py-8 sm:py-12">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="mb-6">
                        <h1 className="text-2xl font-semibold text-white">
                            Transactions
                        </h1>

                        <p className="mt-1 text-sm text-sp-muted">
                            Your spending history
                        </p>
                    </div>


                </div>

                {/* Empty state */}
                {transactions.length === 0 ? (
                    <div className="mt-8 rounded-2xl border border-white/10 bg-sp-surface px-6 py-12 text-center">
                        <h2 className="text-base font-semibold text-white">
                            No transactions yet
                        </h2>

                        <p className="mt-1 text-sm text-sp-muted">
                            Create your first transaction to start building your SpendLog.
                        </p>
                    </div>
                ) : (
                    <div className="mt-8">
                        {transactions.map((transaction, index) => {
                            const currentDate = new Date(
                                transaction.transaction_datetime
                            );

                            const previousDate =
                                index > 0
                                    ? new Date(
                                        transactions[index - 1]
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

                            return (
                                <div key={transaction.id}>
                                    {/* Date heading */}
                                    {showDate && (
                                        <div className="mb-3 mt-6 first:mt-0">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-sp-muted">
                                                {currentDay}
                                            </p>
                                        </div>
                                    )}

                                    {/* Transaction row */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.push(
                                                `/transactions/${transaction.id}`
                                            )
                                        }
                                        className="flex w-full items-center gap-3 border-b border-white/5 py-4 text-left transition hover:bg-white/[0.03] active:bg-white/[0.06]"
                                    >
                                        {/* Transaction icon */}
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sp-primary-deep text-sm font-semibold text-white">
                                            ₹
                                        </div>

                                        {/* Main information */}
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-white">
                                                {transaction.note ||
                                                    "Untitled transaction"}
                                            </p>

                                            <p className="mt-1 text-xs text-sp-muted">
                                                {time} ·{" "}
                                                {transaction.splits.length}{" "}
                                                participant
                                                {transaction.splits.length !==
                                                    1
                                                    ? "s"
                                                    : ""}
                                            </p>
                                        </div>

                                        {/* Amount */}
                                        <p className="shrink-0 text-sm font-semibold tabular-nums text-white">
                                            ₹
                                            {Number(
                                                transaction.total_amount
                                            ).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}
                                        </p>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showCreateTransaction && (
                <CreateTransactionModal
                    onClose={() => setShowCreateTransaction(false)}
                    onCreated={loadTransactions}
                />
            )}
            <FAB
                label="Create transaction"
                onClick={() => setShowCreateTransaction(true)}
            />
        </main>
    );
}