"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">

                <button
                    onClick={() => router.push("/transactions")}
                    className="text-sm font-medium text-slate-500 hover:text-slate-900"
                >
                    ← Back to transactions
                </button>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold text-slate-900">
                                {transaction.note || "Untitled transaction"}
                            </h1>

                            <p className="mt-1 text-sm text-slate-500">
                                {new Date(
                                    transaction.transaction_datetime
                                ).toLocaleString("en-IN")}
                            </p>
                        </div>

                        <p className="text-xl font-semibold tabular-nums text-slate-900">
                            ₹
                            {Number(
                                transaction.total_amount
                            ).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                            })}
                        </p>
                    </div>

                        <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                Paid by
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {transaction.payer_user_name ||
                                    transaction.payer_contact_name}
                            </p>
                        </div>
                        
                    <div className="mt-6 border-t border-slate-100 pt-6">
                        <h2 className="text-sm font-semibold text-slate-900">
                            Split
                        </h2>


                        <div className="mt-3 space-y-2">
                            {transaction.splits.map((split) => (
                                <div
                                    key={`${split.user ?? "u"}-${split.contact ?? "c"}`}
                                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                                >
                                    <span className="text-sm text-slate-700">
                                        {split.user_name || split.contact_name}
                                    </span>

                                    <span className="text-sm font-semibold tabular-nums text-slate-900">
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