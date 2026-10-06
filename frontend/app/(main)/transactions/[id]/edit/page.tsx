"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";

import { getCurrentUser } from "@/services/auth";
import { createContact, getContacts } from "@/services/contacts";
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

    const pad = (n: number) => String(n).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function participantKey(
    split: Pick<EditableSplit, "user" | "contact">
) {
    return split.user !== null
        ? `user:${split.user}`
        : `contact:${split.contact}`;
}

function initials(name?: string | null) {
    return (name ?? "").trim().charAt(0).toUpperCase() || "?";
}

function formatMoney(value: number | string) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) return "0.00";

    return amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatApiError(data: unknown): string | null {
    if (typeof data === "string") return data;

    if (Array.isArray(data)) {
        const messages = data
            .map((item) => formatApiError(item))
            .filter((message): message is string => Boolean(message));

        return messages.length ? messages.join(" ") : null;
    }

    if (data && typeof data === "object") {
        const messages = Object.entries(data as Record<string, unknown>)
            .map(([field, value]) => {
                const message = formatApiError(value);
                return message ? `${field}: ${message}` : null;
            })
            .filter((message): message is string => Boolean(message));

        return messages.length ? messages.join(" ") : null;
    }

    return null;
}

export default function EditTransactionPage() {
    const params = useParams();
    const router = useRouter();

    const [transaction, setTransaction] =
        useState<TransactionResponse | null>(null);
    const [form, setForm] = useState<EditForm | null>(null);

    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const [step, setStep] = useState<1 | 2>(1);

    const [showNewContact, setShowNewContact] = useState(false);
    const [newContactName, setNewContactName] = useState("");
    const [contactError, setContactError] = useState<string | null>(null);

    const nextClientSplitId = useRef(0);

    useEffect(() => {
        let active = true;
        const transactionId = Number(params.id);

        async function loadData() {
            if (!Number.isInteger(transactionId) || transactionId <= 0) {
                setError("Invalid transaction ID.");
                setLoading(false);
                return;
            }

            try {
                const [transactionData, userData, contactData] =
                    await Promise.all([
                        getTransaction(transactionId),
                        getCurrentUser(),
                        getContacts(),
                    ]);

                if (!active) return;

                const data = transactionData as TransactionResponse;

                setTransaction(data);
                setCurrentUser(userData as CurrentUser);
                setContacts(contactData as Contact[]);

                setForm({
                    payer_user: data.payer_user,
                    payer_contact: data.payer_contact,
                    total_amount: String(data.total_amount),
                    note: data.note ?? "",
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
                console.error("Failed to load edit data:", loadError);

                if (active) {
                    setError("Failed to load transaction.");
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        loadData();

        return () => {
            active = false;
        };
    }, [params.id]);

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
                <div className="mx-auto max-w-2xl">
                    <p className="text-sm text-slate-500">
                        Loading transaction...
                    </p>
                </div>
            </main>
        );
    }

    if (error || !transaction || !form) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
                <div className="mx-auto max-w-2xl">
                    <p className="text-sm text-red-600">
                        {error ?? "Transaction not found."}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                transaction
                                    ? `/transactions/${transaction.id}`
                                    : "/transactions"
                            )
                        }
                        className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                        ← Back
                    </button>
                </div>
            </main>
        );
    }

    const originalPayerKey = participantKey({
        user: transaction.payer_user,
        contact: transaction.payer_contact,
    });

    /*
     * IMPORTANT:
     * The payer's automatic self-settlement does not count as real
     * settlement activity. Only a non-payer split with settled_amount > 0
     * locks the transaction's payer/total and that participant's amount.
     */
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

    const availableContacts = contacts.filter(
        (contact) =>
            !includedParticipants.has(`contact:${contact.id}`)
    );

    const canAddCurrentUser =
        currentUser !== null &&
        !includedParticipants.has(`user:${currentUser.id}`);

    const splitTotal = form.splits.reduce((sum, split) => {
        const amount = Number(split.amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    const totalAmount = Number(form.total_amount);
    const difference = splitTotal - totalAmount;
    const amountsMatch =
        Number.isFinite(totalAmount) &&
        totalAmount > 0 &&
        Math.abs(difference) < 0.005;

    function updateForm(updater: (current: EditForm) => EditForm) {
        setForm((current) => (current ? updater(current) : current));
    }

    function addParticipant(
        participant: Pick<
            EditableSplit,
            "user" | "user_name" | "contact" | "contact_name"
        >
    ) {
        updateForm((current) => {
            const key = participantKey(participant);

            if (current.splits.some((split) => participantKey(split) === key)) {
                return current;
            }

            nextClientSplitId.current += 1;

            return {
                ...current,
                splits: [
                    ...current.splits,
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
        updateForm((current) => {
            const split = current.splits.find(
                (item) => item.id === splitId
            );

            if (!split) return current;

            const payerKey = participantKey({
                user: current.payer_user,
                contact: current.payer_contact,
            });

            const isOriginalPayer = participantKey(split) === originalPayerKey;
            const isLocked =
                split.settled_amount > 0 && !isOriginalPayer;

            if (isLocked || participantKey(split) === payerKey) {
                return current;
            }

            return {
                ...current,
                splits: current.splits.filter(
                    (item) => item.id !== splitId
                ),
            };
        });
    }

    function handlePayerChange(value: string) {
        if (originalHasRealSettlement) return;

        const [type, idValue] = value.split(":");
        const id = Number(idValue);

        if (!Number.isInteger(id) || id <= 0) return;

        const participant =
            type === "user"
                ? currentUser?.id === id
                    ? {
                          user: currentUser.id,
                          user_name: currentUser.username,
                          contact: null,
                          contact_name: null,
                      }
                    : null
                : (() => {
                      const contact = contacts.find(
                          (item) => item.id === id
                      );

                      return contact
                          ? {
                                user: null,
                                user_name: null,
                                contact: contact.id,
                                contact_name: contact.name,
                            }
                          : null;
                  })();

        if (!participant) return;

        updateForm((current) => {
            const newPayerKey = participantKey(participant);

            const existingNewPayer = current.splits.find(
                (split) => participantKey(split) === newPayerKey
            );

                let nextSplits = current.splits.map((split) => {
                if (participantKey(split) === originalPayerKey) {
                    /*
                     * The old payer becomes an ordinary participant.
                     * Its automatic self-settlement disappears.
                     */
                    return {
                        ...split,
                        settled_amount: 0,
                        remaining_amount: Number(split.amount) || 0,
                        settled: false,
                    };
                }

                return split;
            });

            if (!existingNewPayer) {
                nextClientSplitId.current += 1;

                nextSplits = [
                    ...nextSplits,
                    {
                        id: `new-${nextClientSplitId.current}`,
                        ...participant,
                        amount: "0",
                        settled_amount: 0,
                        remaining_amount: 0,
                        settled: false,
                    },
                ];
            }

            /*
             * The backend will auto-settle the new payer to their final
             * amount when saved. We intentionally do not alter the amount
             * here: editing the amount remains a separate step.
             */
            return {
                ...current,
                payer_user: participant.user,
                payer_contact: participant.contact,
                splits: nextSplits,
            };
        });
    }

    function updateSplitAmount(
        splitId: EditableSplit["id"],
        amount: string
    ) {
        updateForm((current) => ({
            ...current,
            splits: current.splits.map((split) => {
                if (split.id !== splitId) return split;

                const isOriginalPayer =
                    participantKey(split) === originalPayerKey;

                const isLocked =
                    split.settled_amount > 0 && !isOriginalPayer;

                return isLocked ? split : { ...split, amount };
            }),
        }));
    }

    async function handleCreateContact() {
        const name = newContactName.trim();

        if (!name) {
            setContactError("Enter a contact name.");
            return;
        }

        try {
            setContactError(null);

            const newContact = await createContact(name);

            setContacts((current) => [...current, newContact]);

            addParticipant({
                user: null,
                user_name: null,
                contact: newContact.id,
                contact_name: newContact.name,
            });

            setNewContactName("");
            setShowNewContact(false);
        } catch (createError) {
            console.error("Failed to create contact:", createError);

            if (axios.isAxiosError(createError)) {
                setContactError(
                    formatApiError(createError.response?.data) ??
                        "Unable to create contact."
                );
            } else {
                setContactError("Unable to create contact.");
            }
        }
    }

    function goToSplitStep() {
        if (!form) return;

        if (!form.transaction_datetime) {
            alert("Please select the transaction date and time.");
            return;
        }

        if (form.splits.length === 0) {
            alert("Add at least one participant.");
            return;
        }

        setSaveError(null);
        setStep(2);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function handleSave() {
        if (saving || !form || !transaction) return;

        if (!amountsMatch) {
            setSaveError("Split amounts must equal the transaction total.");
            return;
        }

        if (!form.transaction_datetime) {
            setSaveError("Please select the transaction date and time.");
            setStep(1);
            return;
        }

        if (form.splits.length === 0) {
            setSaveError("Add at least one participant.");
            setStep(1);
            return;
        }

        setSaving(true);
        setSaveError(null);

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
                setSaveError(
                    formatApiError(saveFailure.response?.data) ??
                        "Unable to save the transaction. Please try again."
                );
            } else if (saveFailure instanceof Error) {
                setSaveError(saveFailure.message);
            } else {
                setSaveError(
                    "Unable to save the transaction. Please try again."
                );
            }
        } finally {
            setSaving(false);
        }
    }

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
        }

        if (type === "contact") {
            const contact = contacts.find((item) => item.id === id);

            if (contact) {
                addParticipant({
                    user: null,
                    user_name: null,
                    contact: contact.id,
                    contact_name: contact.name,
                });
            }
        }
    }

    return (
        <main className="min-h-screen w-full overflow-x-hidden bg-[#101217] text-white">
            <div className="mx-auto flex min-h-screen w-full max-w-2xl min-w-0 flex-col bg-[#101217]">
                {/* Header */}
                <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#101217]/95 px-5 py-4 backdrop-blur sm:px-6">
                    <button
                        type="button"
                        onClick={() => router.push(`/transactions/${transaction.id}`)}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-3xl leading-none text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                        aria-label="Close"
                    >
                        ×
                    </button>

                    <div className="min-w-0 flex-1 px-2 text-center">
                        <h1 className="truncate text-lg font-medium tracking-tight text-white sm:text-xl">
                            {step === 1 ? "Edit transaction" : "Split amounts"}
                        </h1>
                        <p className="mt-0.5 text-xs text-white/35">
                            {step === 1 ? `Transaction #${transaction.id}` : "Update each share"}
                        </p>
                    </div>

                    <div className="h-10 w-10" />
                </header>

                {saveError && (
                    <div className="mx-4 mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3.5 py-3 text-sm text-red-300 sm:mx-6">
                        {saveError}
                    </div>
                )}

                {step === 1 ? (
                    <div className="min-w-0 flex-1 px-4 pb-8 pt-4 sm:px-6">
                        {/* Date + time */}
                        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(110px,0.72fr)]">
                            <label className="relative block">
                                <span className="sr-only">Transaction date</span>
                                <div className="flex h-14 min-w-0 items-center rounded-2xl bg-[#292d2d] px-3 transition focus-within:bg-[#323636] sm:px-4">
                                    <span className="mr-2 shrink-0 text-lg text-white/45 sm:mr-3">▣</span>
                                    <input
                                        type="date"
                                        value={form.transaction_datetime.split("T")[0]}
                                        onChange={(event) => {
                                            const time = form.transaction_datetime.split("T")[1] || "12:00";
                                            updateForm((current) => ({
                                                ...current,
                                                transaction_datetime: `${event.target.value}T${time}`,
                                            }));
                                        }}
                                        className="min-w-0 w-0 flex-1 bg-transparent text-[15px] text-white outline-none [color-scheme:dark] sm:text-[17px]"
                                    />
                                </div>
                            </label>

                            <label className="block">
                                <span className="sr-only">Transaction time</span>
                                <div className="flex h-14 min-w-0 items-center rounded-2xl bg-[#292d2d] px-3 transition focus-within:bg-[#323636] sm:px-4">
                                    <span className="mr-2 shrink-0 text-lg text-white/45 sm:mr-3">◷</span>
                                    <input
                                        type="time"
                                        value={form.transaction_datetime.split("T")[1] || "12:00"}
                                        onChange={(event) => {
                                            const date = form.transaction_datetime.split("T")[0];
                                            updateForm((current) => ({
                                                ...current,
                                                transaction_datetime: `${date}T${event.target.value}`,
                                            }));
                                        }}
                                        className="min-w-0 w-0 flex-1 bg-transparent text-[15px] text-white outline-none [color-scheme:dark] sm:text-[17px]"
                                    />
                                </div>
                            </label>
                        </div>

                        {/* Paid by */}
                        <section className="mt-7">
                            <div className="mb-2.5 flex items-center justify-between">
                                <label htmlFor="edit-payer" className="text-[17px] text-white/55">
                                    Paid by
                                </label>
                                {originalHasRealSettlement && (
                                    <span className="text-xs text-amber-300/70">Locked after settlement</span>
                                )}
                            </div>

                            <div className="relative">
                                <select
                                    id="edit-payer"
                                    value={selectedPayerKey}
                                    disabled={originalHasRealSettlement}
                                    onChange={(event) => handlePayerChange(event.target.value)}
                                    className="h-14 w-full appearance-none rounded-2xl bg-[#292d2d] px-4 pr-12 text-[17px] text-white outline-none transition focus:bg-[#323636] disabled:cursor-not-allowed disabled:opacity-55"
                                >
                                    {currentUser && (
                                        <option value={`user:${currentUser.id}`}>
                                            {currentUser.username} (You)
                                        </option>
                                    )}
                                    {contacts.map((contact) => (
                                        <option key={contact.id} value={`contact:${contact.id}`}>
                                            {contact.name}
                                        </option>
                                    ))}
                                </select>
                                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-white/45">
                                    ▾
                                </span>
                            </div>
                        </section>

                        {/* Amount */}
                        <section className="mt-6">
                            <label htmlFor="edit-total" className="sr-only">
                                Amount
                            </label>
                            <div className="flex min-w-0 items-center justify-center border-b border-white/[0.12] pb-4 pt-1">
                                <span className="mr-2 shrink-0 text-4xl font-light text-white/55 sm:mr-3 sm:text-5xl">₹</span>
                                <input
                                    id="edit-total"
                                    type="text"
                                    inputMode="decimal"
                                    autoFocus
                                    value={form.total_amount}
                                    disabled={originalHasRealSettlement}
                                    onChange={(event) =>
                                        updateForm((current) => ({
                                            ...current,
                                            total_amount: event.target.value,
                                        }))
                                    }
                                    className="min-w-0 w-0 flex-1 bg-transparent text-center text-5xl font-light tracking-tight text-white outline-none placeholder:text-white/25 disabled:text-white/35 sm:text-6xl"
                                    placeholder="0"
                                />
                            </div>
                        </section>

                        {/* Note */}
                        <section className="mt-5">
                            <label htmlFor="edit-note" className="sr-only">
                                Note
                            </label>
                            <input
                                id="edit-note"
                                type="text"
                                value={form.note}
                                onChange={(event) =>
                                    updateForm((current) => ({
                                        ...current,
                                        note: event.target.value,
                                    }))
                                }
                                placeholder="Add note"
                                className="w-full border-b border-white/[0.12] bg-transparent px-2 py-3 text-center text-lg text-white outline-none placeholder:text-white/40 focus:border-white/25"
                            />
                        </section>

                        {/* Participants */}
                        <section className="mt-7">
                            <div className="mb-2.5 flex items-center justify-between">
                                <label htmlFor="edit-participant" className="text-[17px] text-white/55">
                                    Splitties
                                </label>
                                <span className="text-xs text-white/30">
                                    {form.splits.length} selected
                                </span>
                            </div>

                            <div className="relative">
                                <select
                                    id="edit-participant"
                                    defaultValue=""
                                    onChange={(event) => {
                                        handleAddParticipant(event.target.value);
                                        event.target.value = "";
                                    }}
                                    className="h-14 w-full appearance-none rounded-2xl bg-[#292d2d] px-4 pr-12 text-[17px] text-white outline-none transition focus:bg-[#323636]"
                                >
                                    <option value="" disabled>
                                        Add participant
                                    </option>
                                    {availableParticipants.map((participant) => (
                                        <option key={participant.key} value={participant.key}>
                                            {participant.name}
                                            {participant.type === "user" ? " (You)" : ""}
                                        </option>
                                    ))}
                                </select>
                                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-white/45">
                                    ▾
                                </span>
                            </div>

                            {showNewContact ? (
                                <div className="mt-3 rounded-2xl bg-[#292d2d] p-3">
                                    <div className="flex min-w-0 gap-2">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newContactName}
                                            onChange={(event) => {
                                                setNewContactName(event.target.value);
                                                setContactError(null);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    void handleCreateContact();
                                                }
                                            }}
                                            placeholder="Contact name"
                                            className="min-w-0 w-0 flex-1 rounded-xl bg-[#1d2020] px-3.5 py-3 text-white outline-none placeholder:text-white/35 focus:ring-2 focus:ring-blue-400/30"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void handleCreateContact()}
                                            className="shrink-0 rounded-xl bg-[#6f8ed8] px-3.5 text-sm font-semibold text-white transition hover:bg-[#7d9be2] sm:px-4"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    {contactError && (
                                        <p className="mt-2 text-xs text-red-300">{contactError}</p>
                                    )}
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setContactError(null);
                                        setShowNewContact(true);
                                    }}
                                    className="mt-3 text-sm font-medium text-[#8da7ef] transition hover:text-white"
                                >
                                    + New contact
                                </button>
                            )}

                            <div className="mt-4 space-y-2">
                                {form.splits.map((split) => {
                                    const isPayer = participantKey(split) === selectedPayerKey;
                                    const isOriginalPayer = participantKey(split) === originalPayerKey;
                                    const isLocked = split.settled_amount > 0 && !isOriginalPayer;
                                    const name = split.user_name || split.contact_name || "Unknown";

                                    return (
                                        <div
                                            key={split.id}
                                            className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-[#292d2d] px-3 py-3 sm:gap-3 sm:px-3.5"
                                        >
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#657fbf] text-sm font-semibold text-white">
                                                {initials(name)}
                                            </span>

                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[15px] font-medium text-white">
                                                    {name}
                                                </p>
                                                <div className="mt-0.5 flex items-center gap-2 text-xs">
                                                    {isPayer && (
                                                        <span className="text-[#9db4f2]">Payer</span>
                                                    )}
                                                    {isLocked && (
                                                        <span className="text-amber-300/75">Settled</span>
                                                    )}
                                                </div>
                                            </div>

                                            {!isPayer && !isLocked && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeParticipant(split.id)}
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-white/35 transition hover:bg-white/[0.06] hover:text-white/75"
                                                    aria-label={`Remove ${name}`}
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Continue */}
                        <button
                            type="button"
                            onClick={goToSplitStep}
                            className="mt-7 w-full rounded-2xl bg-[#536ba6] px-5 py-4 text-[17px] font-semibold text-white shadow-lg shadow-black/10 transition hover:bg-[#607ab9] active:scale-[0.99]"
                        >
                            Continue to split amounts
                        </button>
                    </div>
                ) : (
                    <div className="min-w-0 flex-1 px-4 pb-8 pt-5 sm:px-6">
                        {/* Selected participants / amount entry */}
                        <section>
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-white/45">Transaction total</p>
                                    <p className="mt-0.5 text-xl font-semibold tabular-nums text-white">
                                        ₹{formatMoney(totalAmount)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSaveError(null);
                                        setStep(1);
                                        window.scrollTo({ top: 0, behavior: "smooth" });
                                    }}
                                    className="rounded-xl px-3 py-2 text-sm font-medium text-[#9db4f2] transition hover:bg-white/[0.05] hover:text-white"
                                >
                                    Edit details
                                </button>
                            </div>

                            <div className="space-y-3">
                                {form.splits.map((split, index) => {
                                    const isOriginalPayer = participantKey(split) === originalPayerKey;
                                    const isLocked = split.settled_amount > 0 && !isOriginalPayer;
                                    const name = split.user_name || split.contact_name || "Unknown";
                                    const remainingAfterEdit = Math.max(
                                        Number(split.amount) - split.settled_amount,
                                        0
                                    );

                                    return (
                                        <div
                                            key={split.id}
                                            className="rounded-3xl bg-[#3a3d3d] p-4 sm:p-5"
                                        >
                                            <div className="mb-3 flex min-w-0 items-center justify-between gap-2.5 sm:gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-lg font-medium text-white">
                                                        {name}
                                                    </p>
                                                    <p className="mt-0.5 text-sm text-white/35">
                                                        {participantKey(split) === selectedPayerKey
                                                            ? "Payer"
                                                            : split.contact
                                                            ? "Contact"
                                                            : "You"}
                                                        {isLocked ? " · settled amount locked" : ""}
                                                    </p>
                                                </div>

                                                {index === 0 && (
                                                    <span className="text-sm text-white/35">
                                                        {form.splits.length} {form.splits.length === 1 ? "person" : "people"}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="relative">
                                                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-white/45">
                                                    ₹
                                                </span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    autoFocus={index === 0}
                                                    value={split.amount}
                                                    disabled={isLocked}
                                                    onChange={(event) =>
                                                        updateSplitAmount(split.id, event.target.value)
                                                    }
                                                    className="h-16 min-w-0 w-full rounded-2xl bg-[#242727] pl-11 pr-3 text-xl font-medium tabular-nums text-white outline-none placeholder:text-white/20 focus:bg-[#292d2d] focus:ring-2 focus:ring-[#718bd0]/35 disabled:cursor-not-allowed disabled:text-white/35 sm:pl-12 sm:pr-4 sm:text-2xl"
                                                    placeholder="0.00"
                                                />
                                            </div>

                                            {isLocked && (
                                                <p className="mt-2 text-xs text-amber-300/65">
                                                    Settled ₹{formatMoney(split.settled_amount)} · Remaining ₹{formatMoney(remainingAfterEdit)}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Summary */}
                        <section className="mt-5 rounded-3xl bg-[#292d2d] p-5">
                            <div className="flex items-center justify-between py-1">
                                <span className="text-[17px] text-white/55">Total</span>
                                <span className="text-[17px] font-medium tabular-nums text-white">
                                    ₹{formatMoney(totalAmount)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-1">
                                <span className="text-[17px] text-white/55">Assigned</span>
                                <span className="text-[17px] font-medium tabular-nums text-white">
                                    ₹{formatMoney(splitTotal)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-1">
                                <span className="text-[17px] text-white/55">
                                    {difference < 0 ? "Remaining" : difference > 0 ? "Over by" : "Status"}
                                </span>
                                <span
                                    className={`text-[17px] font-semibold tabular-nums ${
                                        amountsMatch
                                            ? "text-[#9db4f2]"
                                            : "text-red-400"
                                    }`}
                                >
                                    {amountsMatch
                                        ? "Matched"
                                        : `₹${formatMoney(Math.abs(difference))}`}
                                </span>
                            </div>
                        </section>

                        {!amountsMatch && (
                            <p className="mt-3 px-2 text-center text-sm text-red-300/80">
                                {difference < 0
                                    ? `₹${formatMoney(Math.abs(difference))} still needs to be assigned.`
                                    : `Lower the split by ₹${formatMoney(Math.abs(difference))}.`}
                            </p>
                        )}

                        <div className="mt-5 flex min-w-0 gap-2.5 sm:gap-3">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                    setSaveError(null);
                                    setStep(1);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="flex-1 rounded-2xl bg-[#292d2d] px-4 py-4 text-[16px] font-semibold text-white/70 transition hover:bg-[#333737] hover:text-white disabled:opacity-50"
                            >
                                Back
                            </button>

                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving || !amountsMatch}
                                className="flex-[1.7] rounded-2xl bg-[#536ba6] px-4 py-4 text-[16px] font-semibold text-white shadow-lg shadow-black/10 transition hover:bg-[#607ab9] disabled:cursor-not-allowed disabled:bg-[#3a404e] disabled:text-white/35"
                            >
                                {saving ? "Saving..." : "Save changes"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
