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

    return (
        <main className="min-h-screen bg-sp-bg px-4 pb-24 pt-6 text-white sm:px-6">
            <div className="mx-auto max-w-2xl">

                <button
                    onClick={() => router.back()}
                    className="mb-6 text-sm text-sp-muted transition hover:text-white"
                >
                    ← Back
                </button>

                {loading ? (
                    <p className="text-gray-400">
                        Loading...
                    </p>
                ) : data === null ? (
                    <p className="text-red-400">
                        Failed to load contact.
                    </p>
                ) : (
                    <>
                        {/* Contact Name */}
                        <div className="mb-6">
                            <h1 className="text-2xl font-semibold">
                                {data.contact_name}
                            </h1>

                            <p className="mt-1 text-sm text-sp-muted">
                                Contact balance
                            </p>
                        </div>

                        {/* Balance */}
                        <div className="mb-8 rounded-2xl bg-sp-surface p-5">
                            <h2 className="text-sm font-medium text-sp-muted">
                                Net Balance
                            </h2>

                            {data.balance > 0 ? (
                                <>
                                    <p className="mt-2 text-3xl font-semibold tabular-nums text-sp-success">
                                        +₹{data.balance.toLocaleString("en-IN", {
                                            minimumFractionDigits: 2,
                                        })}
                                    </p>

                                    <p className="mt-1 text-sm text-sp-muted">
                                        {data.contact_name} owes you
                                    </p>
                                </>
                            ) : data.balance < 0 ? (
                                <>
                                    <p className="mt-2 text-3xl font-semibold tabular-nums text-red-400">
                                        -₹{Math.abs(data.balance).toLocaleString("en-IN", {
                                            minimumFractionDigits: 2,
                                        })}
                                    </p>

                                    <p className="mt-1 text-sm text-sp-muted">
                                        You owe {data.contact_name}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="mt-2 text-3xl font-semibold">
                                        ₹0.00
                                    </p>

                                    <p className="mt-1 text-sm text-sp-muted">
                                        Settled
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Transaction History */}
                        <div>
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="text-xl font-semibold">
                                    Transactions
                                </h2>

                                <div className="flex rounded-xl bg-sp-surface p-1">
                                    <button
                                        onClick={() => setShowSettled(false)}
                                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${!showSettled
                                            ? "bg-sp-primary text-white"
                                            : "text-sp-muted hover:text-white"
                                            }`}
                                    >
                                        Unsettled
                                    </button>

                                    <button
                                        onClick={() => setShowSettled(true)}
                                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${showSettled
                                            ? "bg-sp-primary text-white"
                                            : "text-sp-muted hover:text-white"
                                            }`}
                                    >
                                        Settled
                                    </button>
                                </div>
                            </div>

                            {data.transactions.length === 0 ? (
                                <p className="text-gray-400">
                                    No transactions with this contact.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {data.transactions.map((transaction) => (
                                        <div
                                            key={transaction.id}
                                            className="flex items-center justify-between gap-4 rounded-2xl bg-sp-surface p-4"
                                        >
                                            <Link
                                                href={`/transactions/${transaction.id}`}
                                                className="flex-1"
                                            >
                                                <div>
                                                    <p className="font-semibold">
                                                        {transaction.note}
                                                    </p>

                                                    <p className="text-sm text-sp-muted">
                                                        {new Date(
                                                            transaction.date
                                                        ).toLocaleString()}
                                                    </p>

                                                    <p className="text-sm text-sp-muted">
                                                        {transaction.paid_by}
                                                    </p>
                                                </div>
                                            </Link>

                                            <div className="flex items-center gap-4">
                                                <p
                                                    className={`shrink-0 text-lg font-semibold tabular-nums ${transaction.amount > 0
                                                        ? "text-sp-success"
                                                        : transaction.amount < 0
                                                            ? "text-red-400"
                                                            : "text-white"
                                                        }`}
                                                >
                                                    {transaction.amount > 0
                                                        ? `+₹${transaction.amount.toLocaleString("en-IN", {
                                                            minimumFractionDigits: 2,
                                                        })}`
                                                        : transaction.amount < 0
                                                            ? `-₹${Math.abs(transaction.amount).toLocaleString("en-IN", {
                                                                minimumFractionDigits: 2,
                                                            })}`
                                                            : "₹0.00"}
                                                </p>
                                                <button
                                                    onClick={() => handleSettle(transaction.split_id)}
                                                    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${showSettled
                                                        ? "bg-yellow-600 hover:bg-yellow-500"
                                                        : "bg-sp-primary hover:bg-sp-primary-deep"
                                                        }`}
                                                >
                                                    {showSettled ? "UNSETTLE" : "SETTLE"}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                        </div>
                    </>
                )}

            </div>
        </main>
    );
}