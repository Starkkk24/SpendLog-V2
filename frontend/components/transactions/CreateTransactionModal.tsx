"use client";

import { useEffect, useRef, useState } from "react";
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Delete,
    Plus,
    X,
    Check,
} from "lucide-react";
import { getCurrentUser } from "@/services/auth";
import {
    createContact,
    getContacts,
} from "@/services/contacts";
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

type Props = {
    onClose: () => void;
    onCreated: () => void | Promise<void>;
};

function getCurrentDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getCurrentTime() {
    const now = new Date();

    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return `${hours}:${minutes}`;
}

function formatDate(date: string) {
    if (!date) return "";

    return new Date(`${date}T00:00:00`).toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
        }
    );
}

function formatMoney(value: number) {
    return value.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function CreateTransactionModal({
    onClose,
    onCreated,
}: Props) {
    const [user, setUser] =
        useState<CurrentUser | null>(null);

    const [contacts, setContacts] =
        useState<Contact[]>([]);

    const [payerType, setPayerType] =
        useState<"user" | "contact">("user");

    const [payerContactId, setPayerContactId] =
        useState<number | null>(null);

    const [amount, setAmount] = useState("");

    const [note, setNote] = useState("");

    const [date, setDate] =
        useState(getCurrentDate());

    const [time, setTime] =
        useState(getCurrentTime());

    const dateInputRef =
        useRef<HTMLInputElement>(null);

    const timeInputRef =
        useRef<HTMLInputElement>(null);

    const [participants, setParticipants] =
        useState<Participant[]>([]);

    const [showSplitSheet, setShowSplitSheet] =
        useState(false);

    const [showNewContact, setShowNewContact] =
        useState(false);

    const [newContactName, setNewContactName] =
        useState("");

    const [creating, setCreating] =
        useState(false);

    useEffect(() => {
        async function loadData() {
            try {
                const [currentUser, userContacts] =
                    await Promise.all([
                        getCurrentUser(),
                        getContacts(),
                    ]);

                setUser(currentUser);
                setContacts(userContacts);
            } catch (error) {
                console.error(
                    "Failed to load transaction data:",
                    error
                );
            }
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

    const transactionTotal =
        Number(amount || 0);

    const assignedTotal =
        participants.reduce(
            (sum, participant) =>
                sum +
                Number(participant.amount || 0),
            0
        );

    const remaining =
        transactionTotal - assignedTotal;

    const amountsMatch =
        transactionTotal > 0 &&
        assignedTotal === transactionTotal;

    function handleKeypad(value: string) {
        setAmount((current) => {
            if (value === "delete") {
                return current.slice(0, -1);
            }

            if (value === ".") {
                if (current.includes(".")) {
                    return current;
                }

                return current || "0.";
            }

            if (value === "+/-") {
                if (!current) return current;

                return current.startsWith("-")
                    ? current.slice(1)
                    : `-${current}`;
            }

            if (
                value === "÷" ||
                value === "×" ||
                value === "-" ||
                value === "+"
            ) {
                return current;
            }

            if (
                current === "0" &&
                value !== "."
            ) {
                return value;
            }

            return current + value;
        });
    }

    function toggleContact(contact: Contact) {
        setParticipants((current) => {
            const exists = current.some(
                (participant) =>
                    participant.type === "contact" &&
                    participant.id === contact.id
            );

            if (exists) {
                return current.filter(
                    (participant) =>
                        !(
                            participant.type === "contact" &&
                            participant.id === contact.id
                        )
                );
            }

            return [
                ...current,
                {
                    type: "contact",
                    id: contact.id,
                    name: contact.name,
                    amount: "",
                },
            ];
        });
    }

    function toggleUser() {
        if (!user) return;

        setParticipants((current) => {
            const exists = current.some(
                (participant) =>
                    participant.type === "user" &&
                    participant.id === user.id
            );

            if (exists) {
                return current.filter(
                    (participant) =>
                        !(
                            participant.type === "user" &&
                            participant.id === user.id
                        )
                );
            }

            return [
                {
                    type: "user",
                    id: user.id,
                    name: user.username,
                    amount: "",
                },
                ...current,
            ];
        });
    }

    function isParticipant(
        type: "user" | "contact",
        id: number
    ) {
        return participants.some(
            (participant) =>
                participant.type === type &&
                participant.id === id
        );
    }

    function updateParticipantAmount(
        type: "user" | "contact",
        id: number,
        value: string
    ) {
        setParticipants((current) =>
            current.map((participant) =>
                participant.type === type &&
                    participant.id === id
                    ? {
                        ...participant,
                        amount: value,
                    }
                    : participant
            )
        );
    }

    async function handleCreateContact() {
        const trimmed =
            newContactName.trim();

        if (!trimmed) return;

        try {
            const contact =
                await createContact(trimmed);

            setContacts((current) => [
                ...current,
                contact,
            ]);

            setParticipants((current) => [
                ...current,
                {
                    type: "contact",
                    id: contact.id,
                    name: contact.name,
                    amount: "",
                },
            ]);

            setNewContactName("");
            setShowNewContact(false);
        } catch (error) {
            console.error(
                "Failed to create contact:",
                error
            );
        }
    }

    async function handleCreateTransaction() {
        if (!user) return;

        if (!date || !time) {
            alert(
                "Please select date and time."
            );
            return;
        }

        if (!transactionTotal) {
            alert(
                "Please enter a total amount."
            );
            return;
        }

        if (!participants.length) {
            alert(
                "Please select at least one splittie."
            );
            return;
        }

        if (!amountsMatch) {
            alert(
                "Split amounts must equal the total amount."
            );
            return;
        }

        const payload = {
            payer_user:
                payerType === "user"
                    ? user.id
                    : null,

            payer_contact:
                payerType === "contact"
                    ? payerContactId
                    : null,

            total_amount: amount,

            note,

            transaction_datetime:
                `${date}T${time}`,

            splits: participants.map(
                (participant) => ({
                    user:
                        participant.type ===
                            "user"
                            ? participant.id
                            : null,

                    contact:
                        participant.type ===
                            "contact"
                            ? participant.id
                            : null,

                    amount:
                        participant.amount,
                })
            ),
        };

        try {
            setCreating(true);

            await createTransaction(payload);

            await onCreated();
            onClose();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(
                    "Transaction error:",
                    error.response?.data
                );
            } else {
                console.error(
                    "Failed to create transaction:",
                    error
                );
            }
        } finally {
            setCreating(false);
        }
    }

    return (
        <>
            {/* MAIN BOTTOM SHEET */}
            <div
                className="fixed inset-0 z-100 bg-black/60"
                onClick={onClose}
            >
                <div
                    className="absolute inset-x-0 bottom-0 flex max-h-[100dvh] flex-col overflow-hidden rounded-t-[28px] bg-sp-bg shadow-2xl"
                    onClick={(e) =>
                        e.stopPropagation()
                    }
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-10 w-10 items-center justify-center text-sp-muted"
                        >
                            <X size={25} />
                        </button>

                        <h1 className="text-lg font-medium">
                            New transaction
                        </h1>

                        <div className="w-10" />
                    </div>

                    {/* Scrollable content */}
                    <div className="min-h-0 flex-1 overflow-y-auto px-4">
                        {/* DATE + TIME */}
                        <div className="flex items-center justify-between gap-3 py-3">

                            <div
                                className="relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-sp-surface px-3 py-2.5"
                                onClick={() =>
                                    dateInputRef.current?.showPicker?.()
                                }
                            >
                                <ChevronLeft
                                    size={18}
                                    className="text-sp-muted"
                                />

                                <CalendarDays
                                    size={17}
                                    className="text-sp-muted"
                                />

                                <span className="text-sm">
                                    {formatDate(date)}
                                </span>

                                <ChevronRight
                                    size={18}
                                    className="text-sp-muted"
                                />

                                <input
                                    ref={dateInputRef}
                                    type="date"
                                    value={date}
                                    onChange={(e) =>
                                        setDate(e.target.value)
                                    }
                                    className="pointer-events-none absolute h-0 w-0 opacity-0"
                                />
                            </div>

                            <div
                                className="relative flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-sp-surface px-4 py-2.5"
                                onClick={() =>
                                    timeInputRef.current?.showPicker?.()
                                }
                            >
                                <Clock3
                                    size={17}
                                    className="text-sp-muted"
                                />

                                <span className="text-sm tabular-nums">
                                    {time}
                                </span>

                                <input
                                    ref={timeInputRef}
                                    type="time"
                                    value={time}
                                    onChange={(e) =>
                                        setTime(e.target.value)
                                    }
                                    className="pointer-events-none absolute h-0 w-0 opacity-0"
                                />
                            </div>
                        </div>

                        {/* PAID BY */}
                        <section className="mt-2">
                            <p className="mb-2 text-sm text-sp-muted">
                                Paid by:
                            </p>

                            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                                {user && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPayerType(
                                                "user"
                                            );
                                            setPayerContactId(
                                                null
                                            );
                                        }}
                                        className={`shrink-0 rounded-xl px-5 py-2.5 text-sm transition ${payerType ===
                                            "user"
                                            ? "bg-sp-primary text-white"
                                            : "bg-sp-surface text-sp-muted"
                                            }`}
                                    >
                                        {user.username}
                                    </button>
                                )}

                                {contacts.map(
                                    (contact) => (
                                        <button
                                            key={
                                                contact.id
                                            }
                                            type="button"
                                            onClick={() => {
                                                setPayerType(
                                                    "contact"
                                                );
                                                setPayerContactId(
                                                    contact.id
                                                );
                                            }}
                                            className={`shrink-0 rounded-xl px-5 py-2.5 text-sm transition ${payerType ===
                                                "contact" &&
                                                payerContactId ===
                                                contact.id
                                                ? "bg-sp-primary text-white"
                                                : "bg-sp-surface text-sp-muted"
                                                }`}
                                        >
                                            {
                                                contact.name
                                            }
                                        </button>
                                    )
                                )}
                            </div>
                        </section>

                        {/* AMOUNT */}
                        <div className="py-5 text-center">
                            <div className="flex items-center justify-center">
                                <span className="text-4xl text-sp-muted">
                                    ₹
                                </span>

                                <span
                                    className={`min-w-[100px] text-5xl font-light tabular-nums ${amount
                                        ? "text-white"
                                        : "text-sp-muted"
                                        }`}
                                >
                                    {amount || "0"}
                                </span>
                            </div>

                            <div className="mx-auto mt-3 h-px w-3/4 bg-white/10" />

                            <input
                                type="text"
                                value={note}
                                onChange={(e) =>
                                    setNote(
                                        e.target.value
                                    )
                                }
                                placeholder="Add note"
                                className="mt-4 w-full bg-transparent text-center text-sm text-white outline-none placeholder:text-sp-muted"
                            />
                        </div>

                        {/* SPLITTIES */}
                        <section className="pb-4">
                            <p className="mb-2 text-sm text-sp-muted">
                                Splitties:
                            </p>

                            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                                {user && (
                                    <button
                                        type="button"
                                        onClick={
                                            toggleUser
                                        }
                                        className={`shrink-0 rounded-xl px-5 py-2.5 text-sm transition ${isParticipant(
                                            "user",
                                            user.id
                                        )
                                            ? "bg-sp-primary text-white"
                                            : "bg-sp-surface text-sp-muted"
                                            }`}
                                    >
                                        {user.username}
                                    </button>
                                )}

                                {contacts.map(
                                    (contact) => (
                                        <button
                                            key={
                                                contact.id
                                            }
                                            type="button"
                                            onClick={() =>
                                                toggleContact(
                                                    contact
                                                )
                                            }
                                            className={`shrink-0 rounded-xl px-5 py-2.5 text-sm transition ${isParticipant(
                                                "contact",
                                                contact.id
                                            )
                                                ? "bg-sp-primary text-white"
                                                : "bg-sp-surface text-sp-muted"
                                                }`}
                                        >
                                            {
                                                contact.name
                                            }
                                        </button>
                                    )
                                )}

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowNewContact(
                                            true
                                        )
                                    }
                                    className="flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-sp-primary px-4 py-2.5 text-sm text-sp-primary"
                                >
                                    <Plus size={16} />
                                    New
                                </button>
                            </div>
                        </section>
                    </div>

                    {/* KEYPAD */}
                    <div className="relative shrink-0 border-t border-white/5 bg-[#242725] px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
                        <div className="grid grid-cols-4">

                            {/* Row 1 */}
                            <Key
                                label="÷"
                                onClick={() =>
                                    handleKeypad("÷")
                                }
                            />

                            <Key
                                label="7"
                                onClick={() =>
                                    handleKeypad("7")
                                }
                            />

                            <Key
                                label="8"
                                onClick={() =>
                                    handleKeypad("8")
                                }
                            />

                            <Key
                                label="9"
                                icon={
                                    <Delete
                                        size={19}
                                    />
                                }
                                onClick={() =>
                                    handleKeypad(
                                        "delete"
                                    )
                                }
                            />

                            {/* Row 2 */}
                            <Key
                                label="×"
                                onClick={() =>
                                    handleKeypad("×")
                                }
                            />

                            <Key
                                label="4"
                                onClick={() =>
                                    handleKeypad("4")
                                }
                            />

                            <Key
                                label="5"
                                onClick={() =>
                                    handleKeypad("5")
                                }
                            />

                            <Key
                                label="6"
                                onClick={() =>
                                    handleKeypad("6")
                                }
                            />

                            {/* Row 3 */}
                            <Key
                                label="−"
                                onClick={() =>
                                    handleKeypad("-")
                                }
                            />

                            <Key
                                label="1"
                                onClick={() =>
                                    handleKeypad("1")
                                }
                            />

                            <Key
                                label="2"
                                onClick={() =>
                                    handleKeypad("2")
                                }
                            />

                            <Key
                                label="3"
                                onClick={() =>
                                    handleKeypad("3")
                                }
                            />

                            {/* Row 4 */}
                            <Key
                                label="+"
                                onClick={() =>
                                    handleKeypad("+")
                                }
                            />

                            <Key
                                label="+/-"
                                onClick={() =>
                                    handleKeypad(
                                        "+/-"
                                    )
                                }
                            />

                            <Key
                                label="0"
                                onClick={() =>
                                    handleKeypad("0")
                                }
                            />

                            <Key
                                label="."
                                onClick={() =>
                                    handleKeypad(".")
                                }
                            />
                        </div>

                        {/* Set split button */}
                        <button
                            type="button"
                            disabled={
                                !transactionTotal ||
                                participants.length ===
                                0
                            }
                            onClick={() =>
                                setShowSplitSheet(
                                    true
                                )
                            }
                            className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-sp-primary text-white shadow-lg transition active:scale-95 disabled:opacity-30"                        >
                            <ChevronRight
                                size={25}
                            />
                        </button>

                        {/* Confirm visual */}
                        <div className="pointer-events-none absolute bottom-6 left-5 text-sp-muted">
                            <span className="text-xs">
                                {participants.length >
                                    0
                                    ? `${participants.length} split${participants.length !==
                                        1
                                        ? "s"
                                        : ""
                                    }`
                                    : ""}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* NEW CONTACT SHEET */}
            {showNewContact && (
                <div
                    className="fixed inset-0 z-[110] bg-black/60"
                    onClick={() =>
                        setShowNewContact(false)
                    }
                >
                    <div
                        className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-sp-bg p-5"
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-medium">
                                New contact
                            </h2>

                            <button
                                type="button"
                                onClick={() =>
                                    setShowNewContact(
                                        false
                                    )
                                }
                                className="text-sp-muted"
                            >
                                <X />
                            </button>
                        </div>

                        <input
                            autoFocus
                            type="text"
                            value={newContactName}
                            onChange={(e) =>
                                setNewContactName(
                                    e.target.value
                                )
                            }
                            placeholder="Contact name"
                            className="mt-5 w-full rounded-xl bg-sp-surface px-4 py-3 text-white outline-none placeholder:text-sp-muted focus:ring-2 focus:ring-sp-primary"
                        />

                        <button
                            type="button"
                            onClick={
                                handleCreateContact
                            }
                            className="mt-4 w-full rounded-xl bg-sp-primary py-3 font-medium"
                        >
                            Add contact
                        </button>
                    </div>
                </div>
            )}

            {/* SPLIT AMOUNT SHEET */}
            {showSplitSheet && (
                <div
                    className="fixed inset-0 z-[110] bg-black/70"
                    onClick={() =>
                        setShowSplitSheet(false)
                    }
                >
                    <div
                        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[28px] bg-sp-bg p-5"
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() =>
                                    setShowSplitSheet(
                                        false
                                    )
                                }
                                className="flex h-10 w-10 items-center justify-center text-sp-muted"
                            >
                                <X />
                            </button>

                            <h2 className="text-lg font-medium">
                                Split amounts
                            </h2>

                            <div className="w-10" />
                        </div>

                        <div className="mt-5 space-y-3">
                            {participants.map(
                                (participant) => (
                                    <div
                                        key={`${participant.type}-${participant.id}`}
                                        className="rounded-2xl bg-sp-surface p-4"
                                    >
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="font-medium">
                                                {
                                                    participant.name
                                                }
                                            </span>

                                            <span className="text-xs text-sp-muted">
                                                {participant.type ===
                                                    "user"
                                                    ? "You"
                                                    : "Contact"}
                                            </span>
                                        </div>

                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sp-muted">
                                                ₹
                                            </span>

                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                inputMode="decimal"
                                                value={
                                                    participant.amount
                                                }
                                                onChange={(
                                                    e
                                                ) =>
                                                    updateParticipantAmount(
                                                        participant.type,
                                                        participant.id,
                                                        e
                                                            .target
                                                            .value
                                                    )
                                                }
                                                placeholder="0.00"
                                                className="w-full rounded-xl bg-sp-bg py-3 pl-9 pr-4 text-white outline-none placeholder:text-sp-muted focus:ring-2 focus:ring-sp-primary"
                                            />
                                        </div>
                                    </div>
                                )
                            )}
                        </div>

                        {/* Summary */}
                        <div className="mt-5 rounded-2xl bg-sp-surface p-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-sp-muted">
                                    Total
                                </span>

                                <span>
                                    ₹
                                    {formatMoney(
                                        transactionTotal
                                    )}
                                </span>
                            </div>

                            <div className="mt-2 flex justify-between text-sm">
                                <span className="text-sp-muted">
                                    Assigned
                                </span>

                                <span>
                                    ₹
                                    {formatMoney(
                                        assignedTotal
                                    )}
                                </span>
                            </div>

                            <div className="mt-2 flex justify-between text-sm">
                                <span className="text-sp-muted">
                                    {remaining <
                                        0
                                        ? "Over by"
                                        : "Remaining"}
                                </span>

                                <span
                                    className={
                                        amountsMatch
                                            ? "text-sp-success"
                                            : "text-red-400"
                                    }
                                >
                                    ₹
                                    {formatMoney(
                                        Math.abs(
                                            remaining
                                        )
                                    )}
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            disabled={
                                !amountsMatch ||
                                creating
                            }
                            onClick={
                                handleCreateTransaction
                            }
                            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-sp-primary py-4 font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Check size={19} />

                            {creating
                                ? "Creating..."
                                : "Create transaction"}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

/* KEYPAD BUTTON */

function Key({
    label,
    icon,
    onClick,
}: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex h-14 items-center justify-center text-xl text-white transition active:bg-white/10"
        >
            {icon || label}
        </button>
    );
}