"use client";



import { useEffect, useRef, useState } from "react";

import { useParams, useRouter } from "next/navigation";

import axios from "axios";

import { getCurrentUser } from "@/services/auth";

import { getContacts } from "@/services/contacts";

import {

    getTransaction,

    updateTransaction,

} from "@/services/transactions";



type Contact = {

    id: number;

    name: string;

};



type CurrentUser = {

    id: number;

    username: string;

};



type TransactionSplitResponse = {

    id: number;

    user: number | null;

    user_name: string | null;

    contact: number | null;

    contact_name: string | null;

    amount: string | number;

    settled_amount: string | number;

    remaining_amount: string | number;

    settled: boolean;

};



type TransactionResponse = {

    id: number;

    payer_user: number | null;

    payer_user_name: string | null;

    payer_contact: number | null;

    payer_contact_name: string | null;

    total_amount: string | number;

    note: string;

    transaction_datetime: string;

    splits: TransactionSplitResponse[];

};



type EditableSplit = {

    id: number | string;

    user: number | null;

    user_name: string | null;

    contact: number | null;

    contact_name: string | null;

    amount: string;

    settled_amount: number;

    remaining_amount: number;

    settled: boolean;

};



type EditForm = {

    payer_user: number | null;

    payer_contact: number | null;

    total_amount: string;

    note: string;

    transaction_datetime: string;

    splits: EditableSplit[];

};



function toDateTimeLocal(value: string) {

    const date = new Date(value);



    if (Number.isNaN(date.getTime())) {

        return value.slice(0, 16);

    }



    const pad = (number: number) => String(number).padStart(2, "0");



    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(

        date.getDate()

    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

}



function participantKey(split: Pick<EditableSplit, "user" | "contact">) {

    return split.user !== null

        ? `user:${split.user}`

        : `contact:${split.contact}`;

}



function formatApiError(data: unknown): string | null {

    if (typeof data === "string") return data;



    if (Array.isArray(data)) {

        const messages = data

            .map((item) => formatApiError(item))

            .filter((message): message is string => Boolean(message));



        return messages.length > 0 ? messages.join(" ") : null;

    }



    if (data && typeof data === "object") {

        const messages = Object.entries(data as Record<string, unknown>)

            .map(([field, value]) => {

                const message = formatApiError(value);

                return message ? `${field}: ${message}` : null;

            })

            .filter((message): message is string => Boolean(message));



        return messages.length > 0 ? messages.join(" ") : null;

    }



    return null;

}



export default function EditTransactionPage() {

    const params = useParams();

    const router = useRouter();

    const [transaction, setTransaction] =

        useState<TransactionResponse | null>(null);

    const [form, setForm] = useState<EditForm | null>(null);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState<string | null>(null);

    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

    const [contacts, setContacts] = useState<Contact[]>([]);

    const [saving, setSaving] = useState(false);

    const [saveError, setSaveError] = useState<string | null>(null);

    const nextClientSplitId = useRef(0);



    useEffect(() => {

        let active = true;

        const transactionId = Number(params.id);



        async function loadTransaction() {

            if (!Number.isInteger(transactionId) || transactionId <= 0) {

                if (active) {

                    setError("Invalid transaction ID.");

                    setLoading(false);

                }

                return;

            }



            try {

                const data = (await getTransaction(

                    transactionId

                )) as TransactionResponse;



                if (!active) return;



                setTransaction(data);

                setForm({

                    payer_user: data.payer_user,

                    payer_contact: data.payer_contact,

                    total_amount: String(data.total_amount),

                    note: data.note,

                    transaction_datetime: toDateTimeLocal(

                        data.transaction_datetime

                    ),

                    splits: data.splits.map((split) => ({

                        id: split.id,

                        user: split.user,

                        user_name: split.user_name,

                        contact: split.contact,

                        contact_name: split.contact_name,

                        amount: String(split.amount),

                        settled_amount: Number(split.settled_amount),

                        remaining_amount: Number(split.remaining_amount),

                        settled: split.settled,

                    })),

                });

            } catch (loadError) {

                console.error("Failed to load transaction:", loadError);



                if (active) {

                    setError("Failed to load transaction.");

                }

            } finally {

                if (active) {

                    setLoading(false);

                }

            }

        }



        loadTransaction();



        return () => {

            active = false;

        };

    }, [params.id]);



    useEffect(() => {

        let active = true;



        async function loadParticipantOptions() {

            try {

                const [userData, contactData] = await Promise.all([

                    getCurrentUser(),

                    getContacts(),

                ]);



                if (!active) return;



                setCurrentUser(userData as CurrentUser);

                setContacts(contactData as Contact[]);

            } catch (loadError) {

                console.error("Failed to load participant options:", loadError);

            }

        }



        loadParticipantOptions();



        return () => {

            active = false;

        };

    }, []);



    function addParticipant(

        participant: Pick<EditableSplit, "user" | "user_name" | "contact" | "contact_name">

    ) {

        setForm((currentForm) => {

            if (!currentForm) return currentForm;



            const key = participantKey(participant);

            const alreadyIncluded = currentForm.splits.some(

                (split) => participantKey(split) === key

            );



            if (alreadyIncluded) return currentForm;



            nextClientSplitId.current += 1;



            return {

                ...currentForm,

                splits: [

                    ...currentForm.splits,

                    {

                        id: `new-${nextClientSplitId.current}`,

                        ...participant,

                        amount: "0",

                        settled_amount: 0,

                        remaining_amount: 0,

                        settled: false,

                    },

                ],

            };

        });

    }



    function removeParticipant(splitId: EditableSplit["id"]) {

        setForm((currentForm) => {

            if (!currentForm) return currentForm;



            const split = currentForm.splits.find(

                (currentSplit) => currentSplit.id === splitId

            );



            if (!split) return currentForm;



            const payerKey = participantKey({

                user: currentForm.payer_user,

                contact: currentForm.payer_contact,

            });

            const originalPayerKey = transaction

                ? participantKey({

                    user: transaction.payer_user,

                    contact: transaction.payer_contact,

                })

                : null;

            const splitIsLocked =

                split.settled_amount > 0 &&

                participantKey(split) !== originalPayerKey;



            if (

                splitIsLocked ||

                participantKey(split) === payerKey

            ) {

                return currentForm;

            }



            return {

                ...currentForm,

                splits: currentForm.splits.filter(

                    (currentSplit) => currentSplit.id !== splitId

                ),

            };

        });

    }



    if (loading) {

        return <main>Loading transaction...</main>;

    }



    if (error) {

        return <main>{error}</main>;

    }



    if (!transaction || !form) {

        return <main>Transaction not found.</main>;

    }



    const originalPayerKey = participantKey({

        user: transaction.payer_user,

        contact: transaction.payer_contact,

    });

    const originalHasRealSettlement = transaction.splits.some(

        (split) =>

            Number(split.settled_amount) > 0 &&

            participantKey(split) !== originalPayerKey

    );

    const selectedPayerKey = participantKey({

        user: form.payer_user,

        contact: form.payer_contact,

    });

    const includedParticipants = new Set(

        form.splits.map((split) => participantKey(split))

    );

    const canAddCurrentUser =

        currentUser !== null &&

        !includedParticipants.has(`user:${currentUser.id}`);

    const availableContacts = contacts.filter(

        (contact) => !includedParticipants.has(`contact:${contact.id}`)

    );



    function handlePayerChange(value: string) {

        if (originalHasRealSettlement) return;



        const [type, idValue] = value.split(":");

        const id = Number(idValue);



        if (!Number.isInteger(id) || id <= 0) return;



        const participant =

            type === "user"

                ? currentUser && currentUser.id === id

                    ? {

                        user: currentUser.id,

                        user_name: currentUser.username,

                        contact: null,

                        contact_name: null,

                    }

                    : null

                : contacts.find((contact) => contact.id === id)

                    ? {

                        user: null,

                        user_name: null,

                        contact: id,

                        contact_name: contacts.find(

                            (contact) => contact.id === id

                        )?.name ?? null,

                    }

                    : null;



        if (!participant) return;



        setForm((currentForm) => {

            if (!currentForm) return currentForm;



            const payerKey = participantKey(participant);

            const payerAlreadyIncluded = currentForm.splits.some(

                (split) => participantKey(split) === payerKey

            );



            nextClientSplitId.current += payerAlreadyIncluded ? 0 : 1;



            return {

                ...currentForm,

                payer_user: participant.user,

                payer_contact: participant.contact,

                splits: payerAlreadyIncluded

                    ? currentForm.splits

                    : [

                        ...currentForm.splits,

                        {

                            id: `new-${nextClientSplitId.current}`,

                            ...participant,

                            amount: "0",

                            settled_amount: 0,

                            remaining_amount: 0,

                            settled: false,

                        },

                    ],

            };

        });

    }



    async function handleSave() {

        if (saving || !form || !transaction) return;



        setSaving(true);

        setSaveError(null);



        const payerChanged = selectedPayerKey !== originalPayerKey;

        const payload = {

            payer_user: form.payer_user,

            payer_contact: form.payer_contact,

            total_amount: form.total_amount,

            note: form.note,

            transaction_datetime: form.transaction_datetime,

            splits: form.splits.map((split) => ({
                user: split.user,
                contact: split.contact,
                amount: split.amount,
            })),

        };



        try {

            await updateTransaction(transaction.id, payload);

            router.push(`/transactions/${transaction.id}`);

        } catch (saveFailure) {

            console.error("Failed to update transaction:", saveFailure);



            if (axios.isAxiosError(saveFailure)) {

                const backendMessage = formatApiError(

                    saveFailure.response?.data

                );

                setSaveError(

                    backendMessage ??

                    "Unable to save the transaction. Please try again."

                );

            } else if (saveFailure instanceof Error) {

                setSaveError(saveFailure.message);

            } else {

                setSaveError("Unable to save the transaction. Please try again.");

            }

        } finally {

            setSaving(false);

        }

    }



    const splitTotal = form.splits.reduce((sum, split) => {
        const amount = Number(split.amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    const totalAmount = Number(form.total_amount);
    const splitDifference = Number.isFinite(totalAmount)
        ? splitTotal - totalAmount
        : 0;
    const amountsMatch =
        Number.isFinite(totalAmount) && Math.abs(splitDifference) < 0.005;

    const availableParticipants = [
        ...(canAddCurrentUser && currentUser
            ? [
                {
                    key: `user:${currentUser.id}`,
                    name: currentUser.username,
                    type: "user" as const,
                },
            ]
            : []),
        ...availableContacts.map((contact) => ({
            key: `contact:${contact.id}`,
            name: contact.name,
            type: "contact" as const,
        })),
    ];

    function handleAddParticipant(value: string) {
        if (!value) return;

        const [type, idValue] = value.split(":");
        const id = Number(idValue);

        if (!Number.isInteger(id) || id <= 0) return;

        if (type === "user" && currentUser?.id === id) {
            addParticipant({
                user: currentUser.id,
                user_name: currentUser.username,
                contact: null,
                contact_name: null,
            });
            return;
        }

        if (type === "contact") {
            const contact = contacts.find((item) => item.id === id);
            if (!contact) return;

            addParticipant({
                user: null,
                user_name: null,
                contact: contact.id,
                contact_name: contact.name,
            });
        }
    }

    function formatMoney(value: number | string) {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return "₹—";
        return `₹${amount.toFixed(2)}`;
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <button
                        type="button"
                        onClick={() => router.push(`/transactions/${transaction.id}`)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
                    >
                        <span aria-hidden="true">←</span>
                        Back
                    </button>

                    <span className="text-xs font-medium text-slate-400">
                        Transaction #{transaction.id}
                    </span>
                </div>

                <header className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                        Edit transaction
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Update the people involved, amounts, and transaction details.
                    </p>
                </header>

                {saveError && (
                    <div
                        role="alert"
                        className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                        {saveError}
                    </div>
                )}

                <div className="space-y-5">
                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="mb-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Transaction
                            </p>
                            <h2 className="mt-1 text-lg font-semibold text-slate-950">
                                Basic details
                            </h2>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <label
                                    htmlFor="payer"
                                    className="mb-2 block text-sm font-medium text-slate-700"
                                >
                                    Paid by
                                </label>
                                <select
                                    id="payer"
                                    value={selectedPayerKey}
                                    disabled={originalHasRealSettlement}
                                    onChange={(event) => handlePayerChange(event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                >
                                    {currentUser && (
                                        <option value={`user:${currentUser.id}`}>
                                            {currentUser.username} (you)
                                        </option>
                                    )}
                                    {contacts.map((contact) => (
                                        <option
                                            key={contact.id}
                                            value={`contact:${contact.id}`}
                                        >
                                            {contact.name}
                                        </option>
                                    ))}
                                </select>

                                {originalHasRealSettlement && (
                                    <p className="mt-2 text-xs text-amber-700">
                                        Payer cannot be changed after settlement activity.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label
                                    htmlFor="total-amount"
                                    className="mb-2 block text-sm font-medium text-slate-700"
                                >
                                    Total amount
                                </label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        ₹
                                    </span>
                                    <input
                                        id="total-amount"
                                        type="text"
                                        inputMode="decimal"
                                        value={form.total_amount}
                                        disabled={originalHasRealSettlement}
                                        onChange={(event) =>
                                            setForm({ ...form, total_amount: event.target.value })
                                        }
                                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-8 pr-3 text-base font-semibold outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                    />
                                </div>

                                {originalHasRealSettlement && (
                                    <p className="mt-2 text-xs text-amber-700">
                                        Total amount cannot be changed after settlement activity.
                                    </p>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Participants
                                </p>
                                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                                    Split
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Decide who is included and how much each person owes.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {form.splits.map((split) => {
                                const isOriginalPayerSplit =
                                    participantKey(split) === originalPayerKey;
                                const splitIsLocked =
                                    split.settled_amount > 0 && !isOriginalPayerSplit;
                                const isSelectedPayer =
                                    participantKey(split) === selectedPayerKey;

                                const currentAmount = Number(split.amount);
                                const remainingAfterEdit = Number.isFinite(currentAmount)
                                    ? Math.max(currentAmount - split.settled_amount, 0)
                                    : split.remaining_amount;

                                return (
                                    <article
                                        key={split.id}
                                        className={`rounded-2xl border p-4 ${splitIsLocked
                                            ? "border-slate-200 bg-slate-50"
                                            : "border-slate-200 bg-white"
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                                                {(split.user_name ?? split.contact_name ?? "?")
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold text-slate-900">
                                                        {split.user_name ?? split.contact_name ?? "Unknown"}
                                                    </p>

                                                    {isSelectedPayer && (
                                                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                                                            Payer
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                                                    <div className="flex-1">
                                                        <label
                                                            htmlFor={`split-amount-${split.id}`}
                                                            className="mb-1.5 block text-xs font-medium text-slate-500"
                                                        >
                                                            Amount
                                                        </label>
                                                        <div className="relative">
                                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                                ₹
                                                            </span>
                                                            <input
                                                                id={`split-amount-${split.id}`}
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={split.amount}
                                                                disabled={splitIsLocked}
                                                                onChange={(event) =>
                                                                    setForm((currentForm) =>
                                                                        currentForm
                                                                            ? {
                                                                                ...currentForm,
                                                                                splits: currentForm.splits.map(
                                                                                    (currentSplit) =>
                                                                                        currentSplit.id === split.id &&
                                                                                            !(
                                                                                                currentSplit.settled_amount >
                                                                                                0 &&
                                                                                                participantKey(currentSplit) !==
                                                                                                originalPayerKey
                                                                                            )
                                                                                            ? {
                                                                                                ...currentSplit,
                                                                                                amount:
                                                                                                    event.target.value,
                                                                                            }
                                                                                            : currentSplit,
                                                                                ),
                                                                            }
                                                                            : currentForm,
                                                                    )
                                                                }
                                                                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-8 pr-3 text-sm font-medium outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="text-xs text-slate-500 sm:w-44 sm:pb-1">
                                                        {split.settled_amount > 0 ? (
                                                            <div className="space-y-1">
                                                                <p>
                                                                    Settled{" "}
                                                                    <span className="font-medium text-slate-700">
                                                                        {formatMoney(split.settled_amount)}
                                                                    </span>
                                                                </p>
                                                                <p>
                                                                    Remaining{" "}
                                                                    <span className="font-medium text-slate-700">
                                                                        {formatMoney(remainingAfterEdit)}
                                                                    </span>
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-slate-400">Not settled</p>
                                                        )}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        disabled={splitIsLocked || isSelectedPayer}
                                                        onClick={() => removeParticipant(split.id)}
                                                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>

                                                {splitIsLocked && (
                                                    <p className="mt-3 text-xs text-amber-700">
                                                        🔒 This split is locked because settlement activity
                                                        exists.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>

                        <div className="mt-5">
                            <label
                                htmlFor="add-participant"
                                className="mb-2 block text-sm font-medium text-slate-700"
                            >
                                Add participant
                            </label>

                            {availableParticipants.length > 0 ? (
                                <select
                                    id="add-participant"
                                    value=""
                                    onChange={(event) => handleAddParticipant(event.target.value)}
                                    className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-600 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                >
                                    <option value="">+ Add someone</option>
                                    {availableParticipants.map((participant) => (
                                        <option
                                            key={participant.key}
                                            value={participant.key}
                                        >
                                            {participant.name}
                                            {participant.type === "user" ? " (you)" : ""}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
                                    Everyone is already included.
                                </p>
                            )}
                        </div>

                        <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
                            <div>
                                <p className="text-xs text-slate-400">Transaction total</p>
                                <p className="mt-1 font-semibold text-slate-900">
                                    {formatMoney(form.total_amount)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">Split total</p>
                                <p className="mt-1 font-semibold text-slate-900">
                                    {formatMoney(splitTotal)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">Difference</p>
                                <p
                                    className={`mt-1 font-semibold ${amountsMatch ? "text-emerald-600" : "text-red-600"
                                        }`}
                                >
                                    {formatMoney(Math.abs(splitDifference))}
                                </p>
                            </div>
                        </div>

                        {!amountsMatch && (
                            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                Split amounts do not match the transaction total.
                            </p>
                        )}
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="grid gap-5">
                            <div>
                                <label
                                    htmlFor="transaction-note"
                                    className="mb-2 block text-sm font-medium text-slate-700"
                                >
                                    Note
                                </label>
                                <textarea
                                    id="transaction-note"
                                    value={form.note}
                                    onChange={(event) =>
                                        setForm({ ...form, note: event.target.value })
                                    }
                                    rows={4}
                                    placeholder="What was this transaction for?"
                                    className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="transaction-datetime"
                                    className="mb-2 block text-sm font-medium text-slate-700"
                                >
                                    Date & time
                                </label>
                                <input
                                    id="transaction-datetime"
                                    type="datetime-local"
                                    value={form.transaction_datetime}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            transaction_datetime: event.target.value,
                                        })
                                    }
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                />
                            </div>
                        </div>
                    </section>

                    <div className="flex flex-col-reverse gap-3 pb-8 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={() => router.push(`/transactions/${transaction.id}`)}
                            disabled={saving}
                            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? "Saving..." : "Save changes"}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
