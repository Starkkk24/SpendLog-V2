"use client";

import { useEffect, useState, type ReactNode } from "react";
// import { getContacts } from "@/services/contacts";
import { getCurrentUser } from "@/services/auth";
import { createContact, getContacts } from "@/services/contacts";
import { createTransaction } from "@/services/transactions";
import axios from "axios";

type Contact = {
    id: number;
    name: string;
};

type CurrentUser = {
    id: number;
    username: string;
};

type Participant = {
    type: "user" | "contact";
    id: number;
    name: string;
    amount: string;
};

/* ------------------------------------------------------------------ */
/* Presentational helpers (styling only — no business logic)           */
/* ------------------------------------------------------------------ */

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

const labelClass =
    "mb-1.5 block text-sm font-medium text-slate-700";

function formatMoney(value: number) {
    return value.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function initials(name?: string | null) {
    return (name ?? "").trim().charAt(0).toUpperCase() || "?";
}

function Section({
    step,
    title,
    description,
    children,
}: {
    step: string;
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                    {step}
                </span>

                <div>
                    <h2 className="text-base font-semibold tracking-tight text-slate-900">
                        {title}
                    </h2>

                    {description && (
                        <p className="mt-0.5 text-sm text-slate-500">
                            {description}
                        </p>
                    )}
                </div>
            </div>

            {children}
        </section>
    );
}

export default function TransactionsPage() {
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);

    const [payerType, setPayerType] = useState<"user" | "contact">("user");
    const [payerContactId, setPayerContactId] = useState<number | null>(null);

    const [totalAmount, setTotalAmount] = useState("");
    const [note, setNote] = useState("");
    const [transactionDatetime, setTransactionDatetime] = useState("");

    const [participants, setParticipants] = useState<Participant[]>([]);

    const [showNewContact, setShowNewContact] = useState(false);
    const [newContactName, setNewContactName] = useState("");

    useEffect(() => {
        async function loadData() {
            const [currentUser, userContacts] = await Promise.all([
                getCurrentUser(),
                getContacts(),
            ]);

            setUser(currentUser);
            setContacts(userContacts);
        }

        loadData();
    }, []);


    useEffect(() => {
        if (!user) return;

        setParticipants([
            {
                type: "user",
                id: user.id,
                name: user.username,
                amount: "",
            },
        ]);
    }, [user]);

    const assignedTotal = participants.reduce(
        (sum, participant) => sum + Number(participant.amount || 0),
        0
    );

    const transactionTotal = Number(totalAmount || 0);

    const amountsMatch =
        transactionTotal > 0 &&
        assignedTotal === transactionTotal;

    // Display-only value derived from the numbers above.
    const remaining = transactionTotal - assignedTotal;

    async function handleCreateTransaction() {
        if (!user) return;

        if (!transactionDatetime) {
            alert("Please select the transaction date and time.");
            return;
        }

        if (!amountsMatch) {
            alert("Assigned amounts must equal the total amount.");
            return;
        }

        if (participants.length === 0) {
            alert("Add at least one participant.");
            return;
        }

        const payload = {
            payer_user: payerType === "user"
                ? user.id
                : null,

            payer_contact: payerType === "contact"
                ? payerContactId
                : null,

            total_amount: totalAmount,

            note,

            transaction_datetime: transactionDatetime,

            splits: participants.map((participant) => ({
                user: participant.type === "user"
                    ? participant.id
                    : null,

                contact: participant.type === "contact"
                    ? participant.id
                    : null,

                amount: participant.amount,
            })),
        };

        try {
            console.log("Transaction payload:", payload);
            const transaction = await createTransaction(payload);

            console.log("Created transaction:", transaction);

            alert("Transaction created successfully!");

        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.log("Transaction backend error:", error.response?.data);
            } else {
                console.log("Unexpected error:", error);
            }
        }
    }

    const availableContacts = contacts.filter(
        (contact) =>
            !participants.some(
                (participant) =>
                    participant.type === "contact" &&
                    participant.id === contact.id
            )
    );

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">

                {/* ---------------- Header ---------------- */}
                <header className="mb-7">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
                        New transaction
                    </h1>

                    <p className="mt-1.5 text-sm text-slate-500">
                        Record what was spent, who paid, and how it splits between everyone involved.
                    </p>
                </header>

                <div className="space-y-5">

                    {/* ---------------- 1. Payer ---------------- */}
                    <Section
                        step="1"
                        title="Who paid?"
                        description="Pick the person who actually put the money down."
                    >
                        <div className="grid gap-2.5 sm:grid-cols-2">

                            {/* Me */}
                            <label
                                className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${payerType === "user"
                                    ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="payer"
                                    className="peer sr-only"
                                    checked={payerType === "user"}
                                    onChange={() => {
                                        setPayerType("user");
                                        setPayerContactId(null);
                                    }}
                                />

                                <span
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${payerType === "user"
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-100 text-slate-600"
                                        }`}
                                >
                                    {user ? initials(user.username) : "?"}
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-slate-900">
                                        {user?.username ? `Me (${user.username})` : "Me"}
                                    </span>

                                    <span className="block text-xs text-slate-500">
                                        You
                                    </span>
                                </span>

                                <span
                                    className={`h-4 w-4 shrink-0 rounded-full border-2 transition peer-focus-visible:ring-4 peer-focus-visible:ring-blue-500/20 ${payerType === "user"
                                        ? "border-[5px] border-blue-600"
                                        : "border-slate-300"
                                        }`}
                                />
                            </label>

                            {/* Contacts */}
                            {contacts.map((contact) => {
                                const selected =
                                    payerType === "contact" &&
                                    payerContactId === contact.id;

                                return (
                                    <label
                                        key={contact.id}
                                        className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${selected
                                            ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="payer"
                                            className="peer sr-only"
                                            checked={
                                                payerType === "contact" &&
                                                payerContactId === contact.id
                                            }
                                            onChange={() => {
                                                setPayerType("contact");
                                                setPayerContactId(contact.id);
                                            }}
                                        />

                                        <span
                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${selected
                                                ? "bg-blue-600 text-white"
                                                : "bg-slate-100 text-slate-600"
                                                }`}
                                        >
                                            {initials(contact.name)}
                                        </span>

                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-slate-900">
                                                {contact.name}
                                            </span>

                                            <span className="block text-xs text-slate-500">
                                                Contact
                                            </span>
                                        </span>

                                        <span
                                            className={`h-4 w-4 shrink-0 rounded-full border-2 transition peer-focus-visible:ring-4 peer-focus-visible:ring-blue-500/20 ${selected
                                                ? "border-[5px] border-blue-600"
                                                : "border-slate-300"
                                                }`}
                                        />
                                    </label>
                                );
                            })}
                        </div>

                        {contacts.length === 0 && (
                            <p className="mt-3 rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-500">
                                You have no contacts yet. Add one further down and it will show up here next time.
                            </p>
                        )}
                    </Section>

                    {/* ---------------- 2. Details ---------------- */}
                    <Section
                        step="2"
                        title="Transaction details"
                        description="The amount, what it was for, and when it happened."
                    >
                        <div className="space-y-4">

                            <div>
                                <label className={labelClass}>
                                    Total amount
                                </label>

                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-slate-400">
                                        ₹
                                    </span>

                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        inputMode="decimal"
                                        value={totalAmount}
                                        onChange={(e) => setTotalAmount(e.target.value)}
                                        placeholder="0.00"
                                        className={`${inputClass} pl-8 text-lg font-semibold tabular-nums`}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>
                                    Note
                                </label>

                                <input
                                    type="text"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="e.g. Dinner"
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>
                                    Date &amp; time
                                </label>

                                <input
                                    type="datetime-local"
                                    value={transactionDatetime}
                                    onChange={(e) => setTransactionDatetime(e.target.value)}
                                    required
                                    className={inputClass}
                                />

                                {!transactionDatetime && (
                                    <p className="mt-1.5 text-xs text-slate-500">
                                        Required before you can create the transaction.
                                    </p>
                                )}
                            </div>

                        </div>
                    </Section>

                    {/* ---------------- 3. Split ---------------- */}
                    <Section
                        step="3"
                        title="Split between"
                        description="Give each person their share. The shares must add up to the total."
                    >
                        {participants.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                                <p className="text-sm font-medium text-slate-700">
                                    Nobody in this split yet
                                </p>

                                <p className="mt-1 text-sm text-slate-500">
                                    Add someone from the list below to get started.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {participants.map((participant) => (
                                    <div
                                        key={`${participant.type}-${participant.id}`}
                                        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300"
                                    >
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                                            {initials(participant.name)}
                                        </span>

                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-slate-900">
                                                {participant.name}
                                            </span>

                                            <span className="block text-xs text-slate-500">
                                                {participant.type === "user" ? "You" : "Contact"}
                                            </span>
                                        </span>

                                        <div className="relative w-28 shrink-0">
                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                                ₹
                                            </span>

                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                inputMode="decimal"
                                                placeholder="0.00"
                                                value={participant.amount}
                                                onChange={(e) => {
                                                    const amount = e.target.value;

                                                    setParticipants((current) =>
                                                        current.map((p) =>
                                                            p.type === participant.type &&
                                                                p.id === participant.id
                                                                ? { ...p, amount }
                                                                : p
                                                        )
                                                    );
                                                }}
                                                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-7 pr-2.5 text-sm font-medium tabular-nums text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            aria-label={`Remove ${participant.name}`}
                                            title={`Remove ${participant.name}`}
                                            onClick={() => {
                                                setParticipants((current) =>
                                                    current.filter(
                                                        (p) =>
                                                            !(
                                                                p.type === participant.type &&
                                                                p.id === participant.id
                                                            )
                                                    )
                                                );
                                            }}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/15"
                                        >
                                            <svg
                                                viewBox="0 0 20 20"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.8"
                                                strokeLinecap="round"
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                            >
                                                <path d="M5 5l10 10M15 5L5 15" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ---------------- Add participant ---------------- */}
                        <div className="mt-5 border-t border-slate-100 pt-5">
                            <h3 className="text-sm font-medium text-slate-700">
                                Add someone to the split
                            </h3>

                            <div className="mt-3 flex flex-wrap gap-2">
                                {availableContacts.map((contact) => (
                                    <button
                                        key={contact.id}
                                        type="button"
                                        onClick={() => {
                                            setParticipants((current) => [
                                                ...current,
                                                {
                                                    type: "contact",
                                                    id: contact.id,
                                                    name: contact.name,
                                                    amount: "",
                                                },
                                            ]);
                                        }}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-2 pl-2.5 pr-3.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/15"
                                    >
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                                            {initials(contact.name)}
                                        </span>

                                        {contact.name}
                                    </button>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => setShowNewContact(true)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white py-2 pl-2.5 pr-3.5 text-sm font-medium text-blue-600 transition hover:border-blue-400 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/15"
                                >
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                        <svg
                                            viewBox="0 0 20 20"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            className="h-3.5 w-3.5"
                                            aria-hidden="true"
                                        >
                                            <path d="M10 5v10M5 10h10" />
                                        </svg>
                                    </span>

                                    New contact
                                </button>
                            </div>

                            {availableContacts.length === 0 && contacts.length > 0 && (
                                <p className="mt-2.5 text-xs text-slate-500">
                                    Everyone in your contacts is already in this split.
                                </p>
                            )}

                            {showNewContact && (
                                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                        Add someone who isn&apos;t in your contacts yet
                                    </label>

                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <input
                                            type="text"
                                            value={newContactName}
                                            onChange={(e) => setNewContactName(e.target.value)}
                                            placeholder="Contact name"
                                            className={`${inputClass} flex-1`}
                                        />

                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const name = newContactName.trim();

                                                if (!name) return;

                                                try {
                                                    const newContact = await createContact(name);

                                                    setContacts((current) => [
                                                        ...current,
                                                        newContact,
                                                    ]);

                                                    setParticipants((current) => [
                                                        ...current,
                                                        {
                                                            type: "contact",
                                                            id: newContact.id,
                                                            name: newContact.name,
                                                            amount: "",
                                                        },
                                                    ]);

                                                    setNewContactName("");
                                                    setShowNewContact(false);

                                                } catch (error) {
                                                    console.error("Failed to create contact:", error);
                                                }
                                            }}
                                            className="shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25"
                                        >
                                            Add contact
                                        </button>
                                    </div>

                                    <p className="mt-2 text-xs text-slate-500">
                                        They&apos;ll be saved to your contacts and added to this split.
                                    </p>
                                </div>
                            )}
                        </div>
                    </Section>

                    {/* ---------------- 4. Summary + CTA ---------------- */}
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <h2 className="text-base font-semibold tracking-tight text-slate-900">
                            Split summary
                        </h2>

                        <dl className="mt-4 grid grid-cols-3 gap-3">
                            <div className="rounded-xl bg-slate-50 px-3 py-3">
                                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                    Total
                                </dt>

                                <dd className="mt-1 text-base font-semibold tabular-nums text-slate-900 sm:text-lg">
                                    ₹{formatMoney(transactionTotal)}
                                </dd>
                            </div>

                            <div className="rounded-xl bg-slate-50 px-3 py-3">
                                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                    Assigned
                                </dt>

                                <dd className="mt-1 text-base font-semibold tabular-nums text-slate-900 sm:text-lg">
                                    ₹{formatMoney(assignedTotal)}
                                </dd>
                            </div>

                            <div
                                className={`rounded-xl px-3 py-3 ${amountsMatch ? "bg-emerald-50" : "bg-amber-50"
                                    }`}
                            >
                                <dt
                                    className={`text-xs font-medium uppercase tracking-wide ${amountsMatch ? "text-emerald-700" : "text-amber-700"
                                        }`}
                                >
                                    {remaining < 0 ? "Over by" : "Remaining"}
                                </dt>

                                <dd
                                    className={`mt-1 text-base font-semibold tabular-nums sm:text-lg ${amountsMatch ? "text-emerald-700" : "text-amber-700"
                                        }`}
                                >
                                    ₹{formatMoney(Math.abs(remaining))}
                                </dd>
                            </div>
                        </dl>

                        {transactionTotal > 0 && (
                            <div
                                className={`mt-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ${amountsMatch
                                    ? "bg-emerald-50 text-emerald-800"
                                    : "bg-amber-50 text-amber-800"
                                    }`}
                            >
                                <svg
                                    viewBox="0 0 20 20"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="mt-0.5 h-4 w-4 shrink-0"
                                    aria-hidden="true"
                                >
                                    {amountsMatch ? (
                                        <path d="M4.5 10.5l3.5 3.5 7.5-8" />
                                    ) : (
                                        <>
                                            <circle cx="10" cy="10" r="7.25" />
                                            <path d="M10 6.5v4.25M10 13.5h.01" />
                                        </>
                                    )}
                                </svg>

                                <span>
                                    {amountsMatch
                                        ? "The split adds up. You're good to go."
                                        : remaining > 0
                                            ? `₹${formatMoney(remaining)} still needs to be assigned to someone.`
                                            : `The split is over the total by ₹${formatMoney(Math.abs(remaining))}. Lower someone's share.`}
                                </span>
                            </div>
                        )}

                        {transactionTotal <= 0 && (
                            <p className="mt-4 rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-500">
                                Enter a total amount above to start splitting it.
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={handleCreateTransaction}
                            disabled={!amountsMatch}
                            className="mt-5 w-full rounded-xl bg-blue-600 px-6 py-3.5 text-[15px] font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                        >
                            Create transaction
                        </button>

                        {!amountsMatch && (
                            <p className="mt-2.5 text-center text-xs text-slate-500">
                                Available once the assigned amounts match the total.
                            </p>
                        )}
                    </section>

                </div>
            </div>
        </div>
    );
}