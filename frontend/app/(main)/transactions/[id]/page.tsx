"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getTransaction, settleSplit } from "@/services/transactions";

type Split = {
    id: number;
    user: number | null;
    user_name: string | null;
    contact: number | null;
    contact_name: string | null;
    amount: string;
    settled: boolean;
};

type Transaction = {
    id: number;
    payer_user: number | null;
    payer_user_name: string | null;
    payer_contact: number | null;
    payer_contact_name: string | null;
    total_amount: string;
    remaining_amount: string;
    note: string;
    transaction_datetime: string;
    splits: Split[];
};

export default function TransactionDetailPage() {
    const params = useParams();
    const router = useRouter();

    const [transaction, setTransaction] =
        useState<Transaction | null>(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadTransaction() {
            try {
                const data = await getTransaction(Number(params.id));
                setTransaction(data);
            } catch (error) {
                console.error("Failed to load transaction:", error);
            } finally {
                setLoading(false);
            }
        }

        loadTransaction();
    }, [params.id]);

    function canSettle(split: Split) {
        // Current user paid, contact owes them
        if (
            transaction?.payer_user !== null &&
            split.contact !== null
        ) {
            return true;
        }

        // Contact paid, current user owes them
        if (
            transaction?.payer_contact !== null &&
            split.user !== null
        ) {
            return true;
        }

        return false;
    }

    async function handleSettle(splitId: number) {
        try {
            await settleSplit(splitId);

            const data = await getTransaction(Number(params.id));
            setTransaction(data);
        } catch (error) {
            console.error("Failed to settle split:", error);
        }
    }



    if (loading) {
        return (
            <main className="min-h-screen bg-sp-bg px-4 pb-24 pt-6 text-white sm:px-6">
                <div className="mx-auto max-w-3xl">
                    <p className="text-sm text-sp-muted">
                        Loading transaction...
                    </p>
                </div>
            </main>
        );
    }

    if (!transaction) {
        return (
            <main className="min-h-screen bg-sp-bg px-4 pb-24 pt-6 text-white sm:px-6">
                <div className="mx-auto max-w-3xl">
                    <h1 className="text-xl font-semibold text-white">
                        Transaction not found
                    </h1>

                    <button
                        onClick={() => router.push("/transactions")}
                        className="mt-4 text-sm font-medium text-sp-primary hover:text-white"
                    >
                        ← Back to transactions
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-sp-bg px-4 pb-24 pt-6 text-white sm:px-6">
            <div className="mx-auto max-w-3xl">

                <button
                    onClick={() => router.push("/transactions")}
                    className="text-sm font-medium text-sp-muted transition hover:text-white"
                >
                    ← Back to transactions
                </button>

                {/* Transaction Header */}
                <div className="mt-6 rounded-2xl bg-sp-surface p-5 sm:p-6">

                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h1 className="truncate text-2xl font-semibold text-white">
                                {transaction.note || "Untitled transaction"}
                            </h1>

                            <p className="mt-1 text-sm text-sp-muted">
                                {new Date(
                                    transaction.transaction_datetime
                                ).toLocaleString("en-IN")}
                            </p>
                        </div>

                        <div className="shrink-0 space-y-1 text-right">
                            <p className="text-xl font-semibold tabular-nums text-white">
                                ₹
                                {Number(
                                    transaction.total_amount
                                ).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                })}
                            </p>

                            <p className="text-sm tabular-nums text-sp-muted">
                                ₹
                                {Number(
                                    transaction.remaining_amount
                                ).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                })}{" "}
                                remaining
                            </p>
                        </div>
                    </div>

                    {/* Paid By */}
                    <div className="mt-6 rounded-xl bg-sp-primary-deep px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-sp-muted">
                            Paid by
                        </p>

                        <p className="mt-1 text-sm font-semibold text-white">
                            {transaction.payer_user_name ||
                                transaction.payer_contact_name}
                        </p>
                    </div>

                    {/* Splits */}
                    <div className="mt-6 border-t border-white/10 pt-6">
                        <h2 className="text-sm font-semibold text-sp-muted">
                            Split
                        </h2>

                        <div className="mt-3 space-y-3">
                            {transaction.splits.map((split) => (
                                <div
                                    key={`${split.user ?? "u"}-${split.contact ?? "c"}`}
                                    className="flex flex-col gap-3 rounded-xl bg-sp-bg p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    {/* Participant */}
                                    <div className="min-w-0">
                                        {split.contact ? (
                                            <Link
                                                href={`/contacts/${split.contact}`}
                                                className="text-sm font-medium text-white transition hover:text-sp-primary"
                                            >
                                                {split.contact_name}
                                            </Link>
                                        ) : (
                                            <span className="text-sm font-medium text-white">
                                                {split.user_name}
                                            </span>
                                        )}

                                        <p
                                            className={`mt-1 text-xs ${split.settled
                                                ? "text-sp-success"
                                                : "text-sp-muted"
                                                }`}
                                        >
                                            {split.settled
                                                ? "Settled"
                                                : "Unsettled"}
                                        </p>
                                    </div>

                                    {/* Amount + Action */}
                                    <div className="flex items-center gap-3">
                                        {/* <div className="flex shrink-0 items-center gap-3"> */}
                                        <span className="text-sm font-semibold tabular-nums text-white">
                                            ₹
                                            {Number(
                                                split.amount
                                            ).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}
                                        </span>

                                        {canSettle(split) && (
                                            <button
                                                onClick={() =>
                                                    handleSettle(split.id)
                                                }
                                                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${split.settled
                                                    ? "bg-yellow-600 hover:bg-yellow-500"
                                                    : "bg-sp-primary hover:bg-sp-primary-deep"
                                                    }`}
                                            >
                                                {split.settled
                                                    ? "UNSETTLE"
                                                    : "SETTLE"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}