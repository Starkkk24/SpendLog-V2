"use client";

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

    useEffect(() => {
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
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-white">
                            Transactions
                        </h1>

                        <p className="mt-1.5 text-sm text-slate-500">
                            Your recorded spending and money splits.
                        </p>
                    </div>

                    <a
                        href="/transactions/new"
                        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                        + New Transaction
                    </a>
                </div>

                {/* Empty state */}
                {transactions.length === 0 ? (
                    <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                        <h2 className="text-base font-semibold text-slate-900">
                            No transactions yet
                        </h2>bg-gray-800 p-4 rounded-lg

                        <p className="mt-1 text-sm text-slate-500">
                            Create your first transaction to start building your SpendLog.
                        </p>
                    </div>
                ) : (
                    <div  className="mt-8 space-y-3">
                        {transactions.map((transaction) => (
                            <div
                                key={transaction.id}
                                onClick={() => router.push(`/transactions/${transaction.id}`)}
                                className="cursor-pointer rounded-2xl  bg-gray-800 p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                            >
                                <div className="flex items-start justify-between gap-4">

                                    <div className="min-w-0">
                                        <h2 className="truncate font-semibold text-white">
                                            {transaction.note || "Untitled transaction"}
                                        </h2>

                                        <p className="mt-1 text-sm text-shadow-blue-100">
                                            {new Date(
                                                transaction.transaction_datetime
                                            ).toLocaleString("en-IN")}
                                        </p>
                                    </div>

                                    <p className="shrink-0 text-lg font-semibold tabular-nums text-white">
                                        ₹
                                        {Number(
                                            transaction.total_amount
                                        ).toLocaleString("en-IN", {
                                            minimumFractionDigits: 2,
                                        })}
                                    </p>
                                </div>

                                <div className="mt-4 border-t border-slate-50 pt-4">
                                    <p className="text-sm text-slate-300">
                                        {transaction.splits.length} participant
                                        {transaction.splits.length !== 1 ? "s" : ""}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}