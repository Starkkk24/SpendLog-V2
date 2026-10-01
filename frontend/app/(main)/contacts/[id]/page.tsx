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
        <main className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-2xl mx-auto">

                <button
                    onClick={() => router.back()}
                    className="mb-6 text-blue-400 hover:text-blue-300"
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
                        <h1 className="text-3xl font-bold mb-8">
                            {data.contact_name}
                        </h1>

                        {/* Balance */}
                        <div className="bg-gray-800 rounded-xl p-6 mb-8">

                            <h2 className="text-xl font-semibold mb-4">
                                Net Balance
                            </h2>

                            {data.balance > 0 ? (
                                <>
                                    <p className="text-green-500 text-2xl font-bold">+{data.balance}</p>
                                    <p className="text-amber-100 ">
                                        {data.contact_name} owes you ₹
                                        {data.balance}
                                    </p>
                                </>

                            ) : data.balance < 0 ? (
                                <>
                                    <p className="text-red-500 text-2xl font-bold">{data.balance}</p>
                                    <p className="text-amber-100 ">
                                        You owe {data.contact_name} ₹
                                        {Math.abs(data.balance)}
                                    </p>
                                </>

                            ) : (
                                <p className="text-2xl font-bold">
                                    Settled
                                </p>
                            )}

                        </div>

                        {/* Transaction History */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold">
                                    Transactions
                                </h2>

                                <div className="flex rounded-lg bg-gray-700 p-1">
                                    <button
                                        onClick={() => setShowSettled(false)}
                                        className={`px-3 py-1.5 rounded-md text-sm ${!showSettled
                                            ? "bg-gray-900 text-white"
                                            : "text-gray-400"
                                            }`}
                                    >
                                        Unsettled
                                    </button>

                                    <button
                                        onClick={() => setShowSettled(true)}
                                        className={`px-3 py-1.5 rounded-md text-sm ${showSettled
                                            ? "bg-gray-900 text-white"
                                            : "text-gray-400"
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
                                            className="flex items-center justify-between bg-gray-800 rounded-xl p-4"
                                        >
                                            <Link
                                                href={`/transactions/${transaction.id}`}
                                                className="flex-1"
                                            >
                                                <div>
                                                    <p className="font-semibold">
                                                        {transaction.note}
                                                    </p>

                                                    <p className="text-sm text-gray-400">
                                                        {new Date(
                                                            transaction.date
                                                        ).toLocaleString()}
                                                    </p>

                                                    <p className="text-sm text-gray-400">
                                                        {transaction.paid_by}
                                                    </p>
                                                </div>
                                            </Link>

                                            <div className="flex items-center gap-4">
                                                <p
                                                    className={`text-lg font-bold ${transaction.amount > 0
                                                        ? "text-green-400"
                                                        : "text-red-400"
                                                        }`}
                                                >
                                                    {transaction.amount > 0
                                                        ? `+₹${transaction.amount}`
                                                        : `-₹${Math.abs(transaction.amount)}`}
                                                </p>
                                                <button
                                                    onClick={() => handleSettle(transaction.split_id)}
                                                    className={`px-3 py-2 rounded-lg ${showSettled
                                                            ? "bg-yellow-600 hover:bg-yellow-500"
                                                            : "bg-green-600 hover:bg-green-500"
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