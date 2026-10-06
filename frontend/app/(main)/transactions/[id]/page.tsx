"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    getTransaction,
    settleSplit,
    settleSplitCompletely,
    unsettleSplit,
} from "@/services/transactions";

type Split = {
    id: number;
    user: number | null;
    user_name: string | null;
    contact: number | null;
    contact_name: string | null;
    amount: string;
    settled_amount: string;
    remaining_amount: number;
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
    const [settleSplitId, setSettleSplitId] = useState<number | null>(null);
    const [settleAmount, setSettleAmount] = useState("");

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

    function openSettleModal(splitId: number) {
        setSettleSplitId(splitId);
        setSettleAmount("");
    }

    function closeSettleModal() {
        setSettleSplitId(null);
        setSettleAmount("");
    }

    async function handleSettleAmount() {
        if (settleSplitId === null) return;

        try {
            await settleSplit(
                settleSplitId,
                Number(settleAmount)
            );

            const data = await getTransaction(Number(params.id));
            setTransaction(data);

            closeSettleModal();
        } catch (error) {
            console.error("Failed to settle split:", error);
        }
    }

    async function handleSettleCompletely() {
        if (settleSplitId === null) return;

        try {
            await settleSplitCompletely(settleSplitId);

            const data = await getTransaction(Number(params.id));
            setTransaction(data);

            closeSettleModal();
        } catch (error) {
            console.error("Failed to settle split:", error);
        }
    }

    async function handleUnsettle(splitId: number) {
        try {
            await unsettleSplit(splitId);

            const data = await getTransaction(Number(params.id));
            setTransaction(data);
        } catch (error) {
            console.error("Failed to unsettle split:", error);
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
    const settledTotal = transaction.splits.reduce(
        (sum, split) => sum + Number(split.settled_amount),
        0
    );

    const remainingTotal = transaction.splits.reduce(
        (sum, split) => sum + Number(split.remaining_amount),
        0
    );

    return (
        <main className="min-h-screen bg-sp-bg px-4 pb-24 pt-6 text-white sm:px-6">
            <div className="mx-auto max-w-3xl">

                {/* Back */}
                <button
                    onClick={() => router.push("/transactions")}
                    className="text-sm font-medium text-sp-muted transition hover:text-white"
                >
                    ← Transactions
                </button>

                <button
                    onClick={() =>
                        router.push(`/transactions/${transaction.id}/edit`)
                    }
                    className="ml-4 text-sm font-medium text-sp-primary transition hover:text-white"
                >
                    Edit
                </button>

                {/* Transaction Summary */}
                <div className="mt-8">
                    <div className="flex items-start justify-between gap-6">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wider text-sp-muted">
                                Transaction
                            </p>

                            <h1 className="mt-2 truncate text-2xl font-semibold text-white">
                                {transaction.note || "Untitled transaction"}
                            </h1>

                            <p className="mt-2 text-sm text-sp-muted">
                                {new Date(
                                    transaction.transaction_datetime
                                ).toLocaleString("en-IN")}
                            </p>
                        </div>

                        <div className="shrink-0 text-right">
                            <p className="text-2xl font-semibold tabular-nums text-white">
                                ₹
                                {Number(transaction.total_amount).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                })}
                            </p>

                            <p className="mt-1 text-sm tabular-nums text-sp-muted">
                                ₹
                                {settledTotal.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                })}{" "}
                                settled
                            </p>

                            <p className="mt-1 text-sm tabular-nums text-sp-muted">
                                ₹
                                {remainingTotal.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                })}{" "}
                                remaining
                            </p>
                        </div>
                    </div>

                    {/* Paid By */}
                    <div className="mt-8 border-y border-white/5 py-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-sp-muted">
                            Paid by
                        </p>

                        <p className="mt-1 text-sm font-medium text-white">
                            {transaction.payer_user_name ||
                                transaction.payer_contact_name}
                        </p>
                    </div>
                </div>

                {/* Splits */}
                <div className="mt-8">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-sp-muted">
                        Splits
                    </p>

                    <div>
                        {transaction.splits.map((split) => (
                            <div
                                key={`${split.user ?? "u"}-${split.contact ?? "c"}`}
                                className="flex items-center gap-4 border-b border-white/5 py-4"
                            >
                                {/* Participant */}
                                <div className="flex min-w-0 flex-1 items-center gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sp-primary-deep text-sm font-semibold text-white">
                                        {(split.contact_name ||
                                            split.user_name ||
                                            "?")
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>

                                    <div className="min-w-0">
                                        {split.contact ? (
                                            <Link
                                                href={`/contacts/${split.contact}`}
                                                className="block truncate text-sm font-medium text-white transition hover:text-sp-primary"
                                            >
                                                {split.contact_name}
                                            </Link>
                                        ) : (
                                            <p className="truncate text-sm font-medium text-white">
                                                {split.user_name}
                                            </p>
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
                                </div>

                                {/* Amount + Action */}
                                <div className="flex shrink-0 items-center gap-3">

                                    <div className="text-right">
                                        <p className="text-sm font-semibold tabular-nums text-white">
                                            ₹
                                            {Number(split.amount).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}
                                        </p>

                                        <p className="mt-1 text-xs tabular-nums text-sp-muted">
                                            ₹
                                            {Number(split.settled_amount).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}{" "}
                                            settled
                                        </p>

                                        <p className="mt-1 text-xs tabular-nums text-sp-muted">
                                            ₹
                                            {Number(split.remaining_amount).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}{" "}
                                            remaining
                                        </p>
                                    </div>

                                    {canSettle(split) && (
                                        <button
                                            onClick={() =>
                                                split.settled
                                                    ? handleUnsettle(split.id)
                                                    : openSettleModal(split.id)
                                            }
                                            className={`rounded-xl px-3 py-2 text-xs font-medium transition ${split.settled
                                                    ? "bg-yellow-600 hover:bg-yellow-500"
                                                    : "bg-sp-primary hover:bg-sp-primary-deep"
                                                }`}
                                        >
                                            {split.settled ? "UNSETTLE" : "SETTLE"}
                                        </button>
                                    )}

                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {settleSplitId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                    <div className="w-full max-w-sm rounded-2xl bg-sp-surface p-5">

                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-lg font-semibold">
                                Settle
                            </h2>

                            <button
                                onClick={closeSettleModal}
                                className="text-sm text-sp-muted hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-sm text-sp-muted">
                            Remaining
                        </p>

                        <p className="mt-1 text-2xl font-semibold">
                            ₹
                            {Number(
                                transaction.splits.find(
                                    (split) => split.id === settleSplitId
                                )?.remaining_amount ?? 0
                            ).toFixed(2)}
                        </p>

                        <div className="mt-5">
                            <label className="text-sm text-sp-muted">
                                Amount
                            </label>

                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={settleAmount}
                                onChange={(e) =>
                                    setSettleAmount(e.target.value)
                                }
                                placeholder="Enter amount"
                                className="mt-2 w-full rounded-xl bg-sp-bg px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-sp-primary"
                            />
                        </div>

                        <button
                            onClick={handleSettleAmount}
                            className="mt-5 w-full rounded-xl bg-sp-primary px-4 py-3 text-sm font-medium transition hover:bg-sp-primary-deep"
                        >
                            Settle Amount
                        </button>

                        <button
                            onClick={handleSettleCompletely}
                            className="mt-2 w-full rounded-xl bg-sp-primary-deep px-4 py-3 text-sm font-medium transition hover:bg-sp-primary"
                        >
                            Settle Completely
                        </button>

                    </div>
                </div>
            )}
        </main>
    );
}
