"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getTransaction } from "@/services/transactions";

type Split = {
    id: number;
    user: number | null;
    user_name: string | null;
    contact: number | null;
    contact_name: string | null;
    amount: string;
};

type Transaction = {
    id: number;
    payer_user: number | null;
    payer_user_name: string | null;
    payer_contact: number | null;
    payer_contact_name: string | null;
    total_amount: string;
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

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50">
                <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
                    <p className="text-sm text-slate-500">
                        Loading transaction...
                    </p>
                </div>
            </div>
        );
    }

    if (!transaction) {
        return (
            <div className="min-h-screen bg-slate-50">
                <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
                    <h1 className="text-xl font-semibold text-slate-900">
                        Transaction not found
                    </h1>

                    <button
                        onClick={() => router.push("/transactions")}
                        className="mt-4 text-sm font-medium text-blue-600"
                    >
                        ← Back to transactions
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">

                <button
                    onClick={() => router.push("/transactions")}
                    className="text-sm font-medium text-slate-500 hover:text-slate-300"
                >
                    ← Back to transactions
                </button>

                <div className="mt-6 rounded-2xl bg-gray-800 p-6 shadow-sm">

                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold text-white">
                                {transaction.note || "Untitled transaction"}
                            </h1>

                            <p className="mt-1 text-sm text-slate-300">
                                {new Date(
                                    transaction.transaction_datetime
                                ).toLocaleString("en-IN")}
                            </p>
                        </div>

                        <p className="text-xl font-semibold tabular-nums text-white">
                            ₹
                            {Number(
                                transaction.total_amount
                            ).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                            })}
                        </p>
                    </div>

                    <div className="mt-6 rounded-xl bg-slate-700 px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Paid by
                        </p>

                        <p className="mt-1 text-sm font-semibold text-white">
                            {transaction.payer_user_name ||
                                transaction.payer_contact_name}
                        </p>
                    </div>

                    <div className="mt-6 border-t border-slate-50 pt-6">
                        <h2 className="text-sm font-semibold text-slate-300">
                            Split
                        </h2>


                        <div className="mt-3 space-y-2">
                            {transaction.splits.map((split) => (
                                <div
                                    key={`${split.user ?? "u"}-${split.contact ?? "c"}`}
                                    className="flex items-center justify-between rounded-xl bg-slate-700 px-4 py-3"
                                >
                                    {split.contact ? (
                                        <Link
                                            key={`contact-${split.contact}`}
                                            href={`/contacts/${split.contact}`}
                                        >
                                            <span className="text-sm text-white">
                                                {split.contact_name}
                                            </span>
                                        </Link>
                                    ) : (
                                        <span className="text-sm text-white">
                                            {split.user_name}
                                        </span>
                                    )}


                                    <span className="text-sm font-semibold tabular-nums text-white">
                                        ₹{Number(split.amount).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}