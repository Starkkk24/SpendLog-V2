"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
    CalendarDays,
    Check,
    ChevronDown,
    Clock3,
    LockKeyhole,
    Plus,
    X,
} from "lucide-react";

import AmountKeypad, {
    calculateExpression,
} from "@/components/ui/AmountKeypad";
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

type SplitResponse = {
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
    splits: SplitResponse[];
};

type Split = {
    id: number | string;
    user: number | null;
    user_name: string | null;
    contact: number | null;
    contact_name: string | null;
    amount: string;
    percentage: string;
    settled_amount: number;
    remaining_amount: number;
    settled: boolean;
};

type SplitMode = "equal" | "amount" | "percentage";

type FormState = {
    payer_user: number | null;
    payer_contact: number | null;
    total_amount: string;
    note: string;
    date: string;
    time: string;
    splits: Split[];
};

type Props = {
    transactionId: number;
    onClose: () => void;
    onUpdated?: () => void | Promise<void>;
};

function keyOf(
    person: { user: number | null; contact: number | null }
) {
    return person.user !== null
        ? `user:${person.user}`
        : `contact:${person.contact}`;
}

function dateTimeParts(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        const [day = "", time = "12:00"] = value.split("T");
        return { date: day, time: time.slice(0, 5) };
    }

    const pad = (n: number) => String(n).padStart(2, "0");

    return {
        date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
            date.getDate()
        )}`,
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    };
}

function money(value: number | string) {
    const amount = Number(value);

    return (Number.isFinite(amount) ? amount : 0).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }
    );
}

function initials(name: string) {
    return name.trim().charAt(0).toUpperCase() || "?";
}

function apiError(data: unknown): string | null {
    if (typeof data === "string") return data;

    if (Array.isArray(data)) {
        return data
            .map(apiError)
            .filter((message): message is string => Boolean(message))
            .join(" ") || null;
    }

    if (data && typeof data === "object") {
        const messages = Object.entries(
            data as Record<string, unknown>
        )
            .map(([field, value]) => {
                const message = apiError(value);
                return message ? `${field}: ${message}` : null;
            })
            .filter((message): message is string => Boolean(message));

        return messages.join(" ") || null;
    }

    return null;
}

function isLockedSplit(split: Split, payerKey: string) {
    return split.settled_amount > 0 && keyOf(split) !== payerKey;
}

function toCents(value: number | null) {
    return Math.round((value ?? 0) * 100);
}

// Same equal-split rounding as CreateTransactionModal: the first
// `remainder` shares receive one extra cent.
function splitIntoEqualAmounts(
    total: number,
    count: number
): string[] {
    if (count <= 0 || total <= 0) {
        return [];
    }

    const totalCents = Math.round(total * 100);
    const baseCents = Math.floor(totalCents / count);
    const remainderCents = totalCents - baseCents * count;

    return Array.from({ length: count }, (_, index) =>
        (
            (baseCents + (index < remainderCents ? 1 : 0)) /
            100
        ).toFixed(2)
    );
}

// Largest-remainder allocation: whole units that always add up to `target`.
function allocateByWeights(weights: number[], target: number): number[] {
    const sum = weights.reduce((acc, weight) => acc + weight, 0);

    if (sum <= 0 || target <= 0) {
        return weights.map(() => 0);
    }

    const exact = weights.map((weight) => (weight * target) / sum);
    const floors = exact.map((value) => Math.floor(value));
    let shortfall =
        target - floors.reduce((acc, value) => acc + value, 0);

    const order = exact
        .map((value, index) => ({
            index,
            fraction: value - floors[index],
        }))
        .sort(
            (a, b) => b.fraction - a.fraction || a.index - b.index
        );

    for (const { index } of order) {
        if (shortfall <= 0) break;
        floors[index] += 1;
        shortfall -= 1;
    }

    return floors;
}

// Fills in the percentage text from the current amounts. Amounts are
// never touched.
function percentagesFromAmounts(
    splits: Split[],
    totalCents: number
): Split[] {
    if (totalCents <= 0 || !splits.length) return splits;

    const cents = splits.map((split) =>
        Math.max(0, toCents(calculateExpression(split.amount)))
    );
    const assignedCents = cents.reduce((sum, value) => sum + value, 0);

    const basisPoints =
        assignedCents === totalCents
            ? allocateByWeights(cents, 10000)
            : cents.map((value) =>
                Math.round((value * 10000) / totalCents)
            );

    return splits.map((split, index) => ({
        ...split,
        percentage: (basisPoints[index] / 100).toFixed(2),
    }));
}

// Converts percentages into real amounts for the editable splits.
// Settlement-locked splits keep their amount.
function amountsFromPercentages(
    splits: Split[],
    totalCents: number,
    payerKey: string
): Split[] {
    if (totalCents <= 0) return splits;

    const editable = splits.filter(
        (split) => !isLockedSplit(split, payerKey)
    );

    if (!editable.length) return splits;

    const lockedCents = splits.reduce(
        (sum, split) =>
            sum +
            (isLockedSplit(split, payerKey)
                ? toCents(calculateExpression(split.amount))
                : 0),
        0
    );

    const percentages = splits.map((split) =>
        Math.max(0, calculateExpression(split.percentage) ?? 0)
    );
    const totalPercentage = percentages.reduce(
        (sum, value) => sum + value,
        0
    );
    const editablePercentages = splits.flatMap((split, index) =>
        isLockedSplit(split, payerKey) ? [] : [percentages[index]]
    );

    const cents =
        Math.abs(totalPercentage - 100) < 0.005
            ? allocateByWeights(
                editablePercentages,
                Math.max(0, totalCents - lockedCents)
            )
            : editablePercentages.map((value) =>
                Math.round((totalCents * value) / 100)
            );

    let position = 0;

    return splits.map((split) => {
        if (isLockedSplit(split, payerKey)) return split;

        const amount = cents[position] ?? 0;
        position += 1;

        return { ...split, amount: (amount / 100).toFixed(2) };
    });
}

// Equal split across the editable shares; settled shares stay as they are.
function distributeEqually(
    splits: Split[],
    totalCents: number,
    payerKey: string
): Split[] {
    const editableCount = splits.filter(
        (split) => !isLockedSplit(split, payerKey)
    ).length;

    if (!editableCount || totalCents <= 0) return splits;

    const lockedCents = splits.reduce(
        (sum, split) =>
            sum +
            (isLockedSplit(split, payerKey)
                ? toCents(calculateExpression(split.amount))
                : 0),
        0
    );

    const amounts = splitIntoEqualAmounts(
        Math.max(0, totalCents - lockedCents) / 100,
        editableCount
    );

    let position = 0;

    const withAmounts = splits.map((split) => {
        if (isLockedSplit(split, payerKey)) return split;

        const amount = amounts[position] ?? "0.00";
        position += 1;

        return { ...split, amount };
    });

    return percentagesFromAmounts(withAmounts, totalCents);
}

export default function EditTransactionModal({
    transactionId,
    onClose,
    onUpdated,
}: Props) {
    const [transaction, setTransaction] =
        useState<TransactionResponse | null>(null);
    const [form, setForm] = useState<FormState | null>(null);
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    const [showSplitSheet, setShowSplitSheet] = useState(false);
    const [showPayerOptions, setShowPayerOptions] = useState(false);
    const [showParticipantOptions, setShowParticipantOptions] =
        useState(false);
    const [showNewContact, setShowNewContact] = useState(false);

    const [payerSearch, setPayerSearch] = useState("");
    const [participantSearch, setParticipantSearch] = useState("");
    const [newContactName, setNewContactName] = useState("");
    const [contactError, setContactError] = useState<string | null>(null);

    const [keypadTarget, setKeypadTarget] = useState<
        { type: "total" } | null
    >(null);

    const [splitMode, setSplitMode] = useState<SplitMode>("equal");
    const [manualAmountKeys, setManualAmountKeys] = useState<Set<string>>(
        new Set()
    );
    const [manualPercentageKeys, setManualPercentageKeys] = useState<
        Set<string>
    >(new Set());

    const dateRef = useRef<HTMLInputElement>(null);
    const timeRef = useRef<HTMLInputElement>(null);
    const nextSplitId = useRef(0);
    const equalSignature = useRef<string | null>(null);

    useEffect(() => {
        let active = true;

        async function load() {
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
                const dateTime = dateTimeParts(
                    data.transaction_datetime
                );

                setTransaction(data);
                setUser(userData as CurrentUser);
                setContacts(contactData as Contact[]);

                setForm({
                    payer_user: data.payer_user,
                    payer_contact: data.payer_contact,
                    total_amount: String(data.total_amount),
                    note: data.note ?? "",
                    date: dateTime.date,
                    time: dateTime.time,
                    splits: data.splits.map((split) => ({
                        id: split.id,
                        user: split.user,
                        user_name: split.user_name,
                        contact: split.contact,
                        contact_name: split.contact_name,
                        amount: String(split.amount),
                        percentage: "",
                        settled_amount: Number(split.settled_amount),
                        remaining_amount: Number(split.remaining_amount),
                        settled: split.settled,
                    })),
                });
            } catch (loadError) {
                console.error("Failed to load transaction:", loadError);
                if (active) setError("Unable to load this transaction.");
            } finally {
                if (active) setLoading(false);
            }
        }

        void load();

        return () => {
            active = false;
        };
    }, [transactionId]);

    const originalPayerKey = transaction
        ? keyOf({
            user: transaction.payer_user,
            contact: transaction.payer_contact,
        })
        : "";

    // The payer's automatic self-settlement is not real settlement activity.
    const hasRealSettlement = Boolean(
        transaction?.splits.some(
            (split) =>
                Number(split.settled_amount) > 0 &&
                keyOf(split) !== originalPayerKey
        )
    );

    function updateForm(updater: (current: FormState) => FormState) {
        setForm((current) => (current ? updater(current) : current));
    }

    function isLocked(split: Split) {
        return isLockedSplit(split, originalPayerKey);
    }

    // Equal mode keeps the shares equal when the total or the participants
    // change. The first run after loading only records the starting state,
    // so opening the editor never overwrites the saved amounts.
    useEffect(() => {
        if (!form) return;

        const totalValue = calculateExpression(form.total_amount) ?? 0;
        const signature = `${totalValue}|${form.splits
            .map(keyOf)
            .join(",")}`;

        if (equalSignature.current === null) {
            equalSignature.current = signature;
            return;
        }

        if (equalSignature.current === signature) return;

        equalSignature.current = signature;

        if (splitMode !== "equal" || totalValue <= 0) return;

        setForm((current) =>
            current
                ? {
                    ...current,
                    splits: distributeEqually(
                        current.splits,
                        toCents(totalValue),
                        originalPayerKey
                    ),
                }
                : current
        );
    }, [form, splitMode, originalPayerKey]);

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-end bg-black/60 sm:items-center sm:justify-center">
                <div className="w-full rounded-t-[28px] bg-sp-bg p-8 text-center text-sm text-sp-muted sm:max-w-xl sm:rounded-[28px]">
                    Loading transaction...
                </div>
            </div>
        );
    }

    if (error || !transaction || !form) {
        return (
            <div
                className="fixed inset-0 z-[100] flex items-end bg-black/60 sm:items-center sm:justify-center"
                onClick={onClose}
            >
                <div
                    className="w-full rounded-t-[28px] bg-sp-bg p-6 sm:max-w-xl sm:rounded-[28px]"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-medium">
                            Edit transaction
                        </h2>
                        <button type="button" onClick={onClose}>
                            <X />
                        </button>
                    </div>
                    <p className="text-sm text-red-300">
                        {error ?? "Transaction not found."}
                    </p>
                </div>
            </div>
        );
    }

    const currentForm = form;
    const currentTransaction = transaction;

    const selectedPayerKey = keyOf({
        user: currentForm.payer_user,
        contact: currentForm.payer_contact,
    });

    const included = new Set(currentForm.splits.map(keyOf));

    const availableContacts = contacts.filter(
        (contact) => !included.has(`contact:${contact.id}`)
    );

    const availableParticipants = [
        ...(user && !included.has(`user:${user.id}`)
            ? [{
                key: `user:${user.id}`,
                name: user.username,
                type: "user" as const,
            }]
            : []),
        ...availableContacts.map((contact) => ({
            key: `contact:${contact.id}`,
            name: contact.name,
            type: "contact" as const,
        })),
    ].filter((person) =>
        person.name.toLowerCase().includes(
            participantSearch.toLowerCase()
        )
    );

    const payerOptions = [
        ...(user
            ? [{
                key: `user:${user.id}`,
                name: `${user.username} (You)`,
            }]
            : []),
        ...contacts.map((contact) => ({
            key: `contact:${contact.id}`,
            name: contact.name,
        })),
    ].filter((person) =>
        person.name.toLowerCase().includes(payerSearch.toLowerCase())
    );

    const total = calculateExpression(currentForm.total_amount) ?? 0;

    const amounts = currentForm.splits.map((split) =>
        calculateExpression(split.amount)
    );

    const invalidAmount = amounts.some(
        (amount) => amount === null || amount < 0
    );

    const assigned = amounts.reduce<number>(
        (sum, amount) => sum + (amount ?? 0),
        0
    );

    const difference = assigned - total;

    const totalPercentage = currentForm.splits.reduce(
        (sum, split) => sum + (calculateExpression(split.percentage) ?? 0),
        0
    );

    const percentagesMatch = Math.abs(totalPercentage - 100) < 0.005;

    const hasInvalidPercentage = currentForm.splits.some((split) => {
        const value = calculateExpression(split.percentage);

        return (
            split.percentage.trim() !== "" &&
            (value === null || value < 0)
        );
    });

    const amountsMatch =
        total > 0 &&
        !invalidAmount &&
        Math.abs(difference) < 0.005 &&
        (splitMode !== "percentage" ||
            (percentagesMatch && !hasInvalidPercentage));

    const payerName =
        currentForm.payer_user !== null
            ? user?.username ?? currentTransaction.payer_user_name ?? "You"
            : contacts.find(
                (contact) => contact.id === currentForm.payer_contact
            )?.name ?? currentTransaction.payer_contact_name ?? "Contact";

    function addParticipant(
        participant: Pick<
            Split,
            "user" | "user_name" | "contact" | "contact_name"
        >
    ) {
        updateForm((current) => {
            if (
                current.splits.some(
                    (split) => keyOf(split) === keyOf(participant)
                )
            ) {
                return current;
            }

            nextSplitId.current += 1;

            return {
                ...current,
                splits: [
                    ...current.splits,
                    {
                        id: `new-${nextSplitId.current}`,
                        ...participant,
                        amount: "0",
                        percentage: "0",
                        settled_amount: 0,
                        remaining_amount: 0,
                        settled: false,
                    },
                ],
            };
        });
    }

    function removeParticipant(splitId: Split["id"]) {
        updateForm((current) => {
            const split = current.splits.find(
                (item) => item.id === splitId
            );

            if (!split || isLocked(split)) return current;

            if (keyOf(split) === keyOf({
                user: current.payer_user,
                contact: current.payer_contact,
            })) {
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

    function changePayer(value: string) {
        if (hasRealSettlement) return;

        const [type, rawId] = value.split(":");
        const id = Number(rawId);

        if (!Number.isInteger(id) || id <= 0) return;

        const participant =
            type === "user" && user?.id === id
                ? {
                    user: user.id,
                    user_name: user.username,
                    contact: null,
                    contact_name: null,
                }
                : type === "contact"
                    ? (() => {
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
                    })()
                    : null;

        if (!participant) return;

        updateForm((current) => {
            const newPayerKey = keyOf(participant);
            let splits = current.splits.map((split) => {
                if (keyOf(split) !== originalPayerKey) return split;

                return {
                    ...split,
                    settled_amount: 0,
                    remaining_amount:
                        calculateExpression(split.amount) ?? 0,
                    settled: false,
                };
            });

            if (!splits.some((split) => keyOf(split) === newPayerKey)) {
                nextSplitId.current += 1;

                splits = [
                    ...splits,
                    {
                        id: `new-${nextSplitId.current}`,
                        ...participant,
                        amount: "0",
                        percentage: "0",
                        settled_amount: 0,
                        remaining_amount: 0,
                        settled: false,
                    },
                ];
            }

            return {
                ...current,
                payer_user: participant.user,
                payer_contact: participant.contact,
                splits,
            };
        });

        setShowPayerOptions(false);
        setPayerSearch("");
    }

    function addSelectedParticipant(value: string) {
        const [type, rawId] = value.split(":");
        const id = Number(rawId);

        if (type === "user" && user?.id === id) {
            addParticipant({
                user: user.id,
                user_name: user.username,
                contact: null,
                contact_name: null,
            });
        } else if (type === "contact") {
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

        setParticipantSearch("");
        setShowParticipantOptions(false);
    }

    async function handleCreateContact() {
        const name = newContactName.trim();

        if (!name) {
            setContactError("Enter a contact name.");
            return;
        }

        try {
            setContactError(null);

            const contact = await createContact(name);
            setContacts((current) => [...current, contact]);

            addParticipant({
                user: null,
                user_name: null,
                contact: contact.id,
                contact_name: contact.name,
            });

            setNewContactName("");
            setShowNewContact(false);
        } catch (createError) {
            console.error("Failed to create contact:", createError);

            setContactError(
                axios.isAxiosError(createError)
                    ? apiError(createError.response?.data) ??
                    "Unable to create contact."
                    : "Unable to create contact."
            );
        }
    }

    function keypadValue() {
        return keypadTarget === null ? "" : currentForm.total_amount;
    }

    function changeKeypadValue(value: string) {
        if (!keypadTarget || hasRealSettlement) return;

        updateForm((current) => ({
            ...current,
            total_amount: value,
        }));
    }

    function selectEqualMode() {
        setManualAmountKeys(new Set());
        setManualPercentageKeys(new Set());
        setSplitMode("equal");

        if (total <= 0) return;

        updateForm((current) => ({
            ...current,
            splits: distributeEqually(
                current.splits,
                toCents(calculateExpression(current.total_amount)),
                originalPayerKey
            ),
        }));
    }

    function selectAmountMode() {
        setSplitMode("amount");
    }

    function selectPercentageMode() {
        if (splitMode === "percentage") return;

        setSplitMode("percentage");

        // Only fills in the percentage text; amounts are left untouched.
        updateForm((current) => ({
            ...current,
            splits: percentagesFromAmounts(
                current.splits,
                toCents(calculateExpression(current.total_amount))
            ),
        }));
    }

    function updateSplitAmount(target: Split, value: string) {
        if (isLocked(target)) return;

        const key = keyOf(target);

        setManualAmountKeys((current) => new Set(current).add(key));

        updateForm((current) => {
            const editedIndex = current.splits.findIndex(
                (split) => keyOf(split) === key
            );

            if (editedIndex === -1) return current;

            const editedAmount = calculateExpression(value);

            const next = current.splits.map((split, index) =>
                index === editedIndex
                    ? { ...split, amount: value }
                    : split
            );

            if (
                editedAmount === null ||
                editedAmount < 0 ||
                current.splits.length <= 1
            ) {
                return { ...current, splits: next };
            }

            const totalCents = toCents(
                calculateExpression(current.total_amount)
            );
            const editedCents = toCents(editedAmount);

            const manualKeys = new Set(manualAmountKeys);
            manualKeys.add(key);

            // Settlement-locked shares are never adjusted.
            const others = current.splits
                .map((split, index) => ({ split, index }))
                .filter(
                    ({ split, index }) =>
                        index !== editedIndex &&
                        !isLockedSplit(split, originalPayerKey)
                );

            const automatic = others
                .filter(({ split }) => !manualKeys.has(keyOf(split)))
                .map(({ index }) => index);

            // If there are no automatic participants left,
            // adjust the other participant closest to the end.
            const targetIndices =
                automatic.length > 0
                    ? automatic
                    : others.map(({ index }) => index).slice(-1);

            if (targetIndices.length === 0) {
                return { ...current, splits: next };
            }

            const preservedCents = current.splits.reduce(
                (sum, split, index) =>
                    index === editedIndex ||
                        targetIndices.includes(index)
                        ? sum
                        : sum +
                        toCents(calculateExpression(split.amount)),
                editedCents
            );

            const remainingCents = Math.max(
                totalCents - preservedCents,
                0
            );
            const baseCents = Math.floor(
                remainingCents / targetIndices.length
            );
            const remainderCents =
                remainingCents - baseCents * targetIndices.length;

            return {
                ...current,
                splits: next.map((split, index) => {
                    const position = targetIndices.indexOf(index);

                    if (position === -1) return split;

                    const cents =
                        baseCents + (position < remainderCents ? 1 : 0);

                    return { ...split, amount: (cents / 100).toFixed(2) };
                }),
            };
        });
    }

    function updateSplitPercentage(target: Split, value: string) {
        if (isLocked(target)) return;

        const key = keyOf(target);

        setManualPercentageKeys((current) => new Set(current).add(key));

        updateForm((current) => {
            const editedIndex = current.splits.findIndex(
                (split) => keyOf(split) === key
            );

            if (editedIndex === -1) return current;

            const editedPercentage = calculateExpression(value);

            let splits = current.splits.map((split, index) =>
                index === editedIndex
                    ? { ...split, percentage: value }
                    : split
            );

            if (editedPercentage === null || editedPercentage < 0) {
                return { ...current, splits };
            }

            const manualKeys = new Set(manualPercentageKeys);
            manualKeys.add(key);

            const others = current.splits
                .map((split, index) => ({ split, index }))
                .filter(
                    ({ split, index }) =>
                        index !== editedIndex &&
                        !isLockedSplit(split, originalPayerKey)
                );

            const automatic = others
                .filter(({ split }) => !manualKeys.has(keyOf(split)))
                .map(({ index }) => index);

            const targetIndices =
                automatic.length > 0
                    ? automatic
                    : others.map(({ index }) => index).slice(-1);

            if (targetIndices.length > 0) {
                const editedBasisPoints = Math.round(
                    editedPercentage * 100
                );

                const preservedBasisPoints = current.splits.reduce(
                    (sum, split, index) =>
                        index === editedIndex ||
                            targetIndices.includes(index)
                            ? sum
                            : sum +
                            Math.round(
                                (calculateExpression(
                                    split.percentage
                                ) ?? 0) * 100
                            ),
                    editedBasisPoints
                );

                const remainingBasisPoints = Math.max(
                    10000 - preservedBasisPoints,
                    0
                );
                const baseBasisPoints = Math.floor(
                    remainingBasisPoints / targetIndices.length
                );
                const remainderBasisPoints =
                    remainingBasisPoints -
                    baseBasisPoints * targetIndices.length;

                splits = splits.map((split, index) => {
                    const position = targetIndices.indexOf(index);

                    if (position === -1) return split;

                    const basisPoints =
                        baseBasisPoints +
                        (position < remainderBasisPoints ? 1 : 0);

                    return {
                        ...split,
                        percentage: (basisPoints / 100).toFixed(2),
                    };
                });
            }

            // Convert percentages into real amounts.
            return {
                ...current,
                splits: amountsFromPercentages(
                    splits,
                    toCents(calculateExpression(current.total_amount)),
                    originalPayerKey
                ),
            };
        });
    }

    async function handleSave() {
        if (saving) return;

        if (!currentForm.date || !currentForm.time) {
            setSaveError("Please select the transaction date and time.");
            return;
        }

        if (!currentForm.splits.length) {
            setSaveError("Add at least one participant.");
            return;
        }

        if (!amountsMatch) {
            setSaveError("Split amounts must equal the transaction total.");
            return;
        }

        // Percentages are always converted into real amounts before saving;
        // only numeric amounts are sent to the API.
        const payloadSplits =
            splitMode === "percentage"
                ? amountsFromPercentages(
                    currentForm.splits,
                    toCents(total),
                    originalPayerKey
                )
                : currentForm.splits;

        const payloadCents = payloadSplits.reduce(
            (sum, split) =>
                sum + toCents(calculateExpression(split.amount)),
            0
        );

        if (payloadCents !== toCents(total)) {
            setSaveError("Split amounts must equal the transaction total.");
            return;
        }

        setSaving(true);
        setSaveError(null);

        try {
            await updateTransaction(currentTransaction.id, {
                payer_user: currentForm.payer_user,
                payer_contact: currentForm.payer_contact,
                total_amount: total.toFixed(2),
                note: currentForm.note,
                transaction_datetime: `${currentForm.date}T${currentForm.time}`,
                splits: payloadSplits.map((split) => ({
                    user: split.user,
                    contact: split.contact,
                    amount: (
                        calculateExpression(split.amount) ?? 0
                    ).toFixed(2),
                })),
            });

            await onUpdated?.();
            onClose();
        } catch (saveFailure) {
            console.error("Failed to update transaction:", saveFailure);

            setSaveError(
                axios.isAxiosError(saveFailure)
                    ? apiError(saveFailure.response?.data) ??
                    "Unable to save the transaction. Please try again."
                    : saveFailure instanceof Error
                        ? saveFailure.message
                        : "Unable to save the transaction. Please try again."
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            {/* Main edit bottom sheet */}
            <div
                className="fixed inset-0 z-[100] bg-black/60"
                onClick={onClose}
            >
                <div
                    className="absolute inset-x-0 bottom-0 flex max-h-[100dvh] flex-col overflow-hidden rounded-t-[28px] bg-sp-bg shadow-2xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]"
                    onClick={(event) => event.stopPropagation()}
                >
                    <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-10 w-10 items-center justify-center text-sp-muted"
                            aria-label="Close"
                        >
                            <X size={24} />
                        </button>

                        <div className="text-center">
                            <h1 className="text-lg font-medium">
                                Edit transaction
                            </h1>
                            <p className="text-xs text-sp-muted">
                                Transaction #{currentTransaction.id}
                            </p>
                        </div>

                        <div className="w-10" />
                    </header>

                    {saveError && (
                        <div className="mx-4 mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                            {saveError}
                        </div>
                    )}

                    <div className="min-h-0 flex-1 overflow-y-auto px-4">
                        {/* Date and time */}
                        <div className="flex items-center gap-3 py-3">
                            <button
                                type="button"
                                onClick={() => dateRef.current?.showPicker?.()}
                                className="relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-sp-surface px-3 py-3"
                            >
                                <CalendarDays size={17} className="text-sp-muted" />
                                <span className="truncate text-sm">
                                    {currentForm.date
                                        ? new Date(
                                            `${currentForm.date}T00:00:00`
                                        ).toLocaleDateString("en-IN", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                        })
                                        : "Choose date"}
                                </span>
                                <input
                                    ref={dateRef}
                                    type="date"
                                    value={currentForm.date}
                                    onChange={(event) =>
                                        updateForm((current) => ({
                                            ...current,
                                            date: event.target.value,
                                        }))
                                    }
                                    className="pointer-events-none absolute h-0 w-0 opacity-0"
                                    tabIndex={-1}
                                />
                            </button>

                            <button
                                type="button"
                                onClick={() => timeRef.current?.showPicker?.()}
                                className="relative flex items-center justify-center gap-2 rounded-xl bg-sp-surface px-4 py-3"
                            >
                                <Clock3 size={17} className="text-sp-muted" />
                                <span className="text-sm">{currentForm.time}</span>
                                <input
                                    ref={timeRef}
                                    type="time"
                                    value={currentForm.time}
                                    onChange={(event) =>
                                        updateForm((current) => ({
                                            ...current,
                                            time: event.target.value,
                                        }))
                                    }
                                    className="pointer-events-none absolute h-0 w-0 opacity-0"
                                    tabIndex={-1}
                                />
                            </button>
                        </div>

                        {/* Payer */}
                        <section className="py-3">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm text-sp-muted">Paid by</p>
                                {hasRealSettlement && (
                                    <span className="flex items-center gap-1 text-xs text-amber-300/80">
                                        <LockKeyhole size={12} />
                                        Locked after settlement
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                disabled={hasRealSettlement}
                                onClick={() =>
                                    setShowPayerOptions((open) => !open)
                                }
                                className="flex w-full items-center justify-between rounded-xl bg-sp-surface px-4 py-3.5 text-left disabled:opacity-50"
                            >
                                <span>{payerName}</span>
                                <ChevronDown size={18} className="text-sp-muted" />
                            </button>

                            {showPayerOptions && !hasRealSettlement && (
                                <div className="mt-2 rounded-xl bg-sp-surface p-2">
                                    <input
                                        autoFocus
                                        value={payerSearch}
                                        onChange={(event) =>
                                            setPayerSearch(event.target.value)
                                        }
                                        placeholder="Search payer..."
                                        className="mb-2 w-full rounded-lg bg-sp-bg px-3 py-2 text-sm outline-none placeholder:text-sp-muted"
                                    />
                                    <div className="max-h-40 overflow-y-auto">
                                        {payerOptions.map((person) => (
                                            <button
                                                key={person.key}
                                                type="button"
                                                onClick={() =>
                                                    changePayer(person.key)
                                                }
                                                className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-white/5 ${person.key === selectedPayerKey
                                                    ? "text-sp-primary"
                                                    : "text-white"
                                                    }`}
                                            >
                                                {person.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Total and note */}
                        <section className="py-3 text-center">
                            <p className="mb-1 text-sm text-sp-muted">
                                Transaction amount
                            </p>


                            <button
                                type="button"
                                disabled={hasRealSettlement}
                                onClick={() =>
                                    !hasRealSettlement &&
                                    setKeypadTarget({ type: "total" })
                                }
                                className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3 transition-colors disabled:opacity-50 ${keypadTarget?.type === "total"
                                    ? "border-sp-primary bg-[#292d2d] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                                    : "border-transparent"
                                    }`}
                            >
                                <span className="text-4xl font-light text-white/65">
                                    ₹
                                </span>
                                <span className="text-5xl font-light tabular-nums text-white">
                                    {currentForm.total_amount || "0"}
                                </span>
                            </button>


                            {hasRealSettlement && (
                                <p className="text-xs text-amber-300/70">
                                    Total is locked because a split has been settled.
                                </p>
                            )}

                            <div className="mx-auto h-px w-3/4 bg-white/10" />

                            <input
                                value={currentForm.note}
                                onChange={(event) =>
                                    updateForm((current) => ({
                                        ...current,
                                        note: event.target.value,
                                    }))
                                }
                                placeholder="Add note"
                                className="mt-4 w-full bg-transparent px-2 py-2 text-center text-sm outline-none placeholder:text-sp-muted"
                            />
                        </section>

                        {/* Participants */}
                        <section className="py-3">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm text-sp-muted">Splitties</p>
                                <span className="text-xs text-sp-muted">
                                    {currentForm.splits.length} selected
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setShowParticipantOptions((open) => !open)
                                }
                                className="flex w-full items-center justify-between rounded-xl bg-sp-surface px-4 py-3.5 text-left"
                            >
                                <span className="text-sp-muted">
                                    Add participant
                                </span>
                                <Plus size={18} className="text-sp-primary" />
                            </button>

                            {showParticipantOptions && (
                                <div className="mt-2 rounded-xl bg-sp-surface p-2">
                                    <input
                                        autoFocus
                                        value={participantSearch}
                                        onChange={(event) =>
                                            setParticipantSearch(event.target.value)
                                        }
                                        placeholder="Search people..."
                                        className="mb-2 w-full rounded-lg bg-sp-bg px-3 py-2 text-sm outline-none placeholder:text-sp-muted"
                                    />
                                    <div className="max-h-40 overflow-y-auto">
                                        {availableParticipants.map((person) => (
                                            <button
                                                key={person.key}
                                                type="button"
                                                onClick={() =>
                                                    addSelectedParticipant(person.key)
                                                }
                                                className="block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-white/5"
                                            >
                                                {person.name}
                                                {person.type === "user" ? " (You)" : ""}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {showNewContact ? (
                                <div className="mt-3 rounded-xl bg-sp-surface p-3">
                                    <div className="flex gap-2">
                                        <input
                                            autoFocus
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
                                            className="min-w-0 flex-1 rounded-lg bg-sp-bg px-3 py-2.5 text-sm outline-none placeholder:text-sp-muted"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void handleCreateContact()}
                                            className="rounded-lg bg-sp-primary px-4 text-sm font-medium text-white"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    {contactError && (
                                        <p className="mt-2 text-xs text-red-300">
                                            {contactError}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setContactError(null);
                                        setShowNewContact(true);
                                    }}
                                    className="mt-3 flex items-center gap-1 text-sm text-sp-primary"
                                >
                                    <Plus size={15} />
                                    New contact
                                </button>
                            )}

                            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                                {currentForm.splits.map((split) => {
                                    const name =
                                        split.user_name ||
                                        split.contact_name ||
                                        "Unknown";
                                    const payer =
                                        keyOf(split) === selectedPayerKey;
                                    const locked = isLocked(split);

                                    return (
                                        <div
                                            key={split.id}
                                            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 ${payer
                                                ? "bg-sp-primary text-white"
                                                : "bg-sp-surface text-white"
                                                }`}
                                        >
                                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/15 text-xs font-semibold">
                                                {initials(name)}
                                            </span>
                                            <span className="max-w-32 truncate text-sm">
                                                {split.user !== null ? "ME" : name}
                                            </span>
                                            {locked && <LockKeyhole size={13} />}
                                            {!payer && !locked && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeParticipant(split.id)
                                                    }
                                                    className="ml-1 text-white/60 hover:text-white"
                                                    aria-label={`Remove ${name}`}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Split summary */}
                        <button
                            type="button"
                            onClick={() => {
                                setSaveError(null);
                                setShowSplitSheet(true);
                            }}
                            className="my-3 flex w-full items-center justify-between rounded-2xl bg-sp-surface px-4 py-4 text-left"
                        >
                            <div>
                                <p className="font-medium">Split amounts</p>
                                <p className="mt-1 text-xs text-sp-muted">
                                    Assigned ₹{money(assigned)} of ₹{money(total)}
                                </p>
                            </div>
                            <span
                                className={`text-sm font-medium ${amountsMatch
                                    ? "text-emerald-300"
                                    : "text-amber-300"
                                    }`}
                            >
                                {amountsMatch
                                    ? "Matched"
                                    : `₹${money(Math.abs(difference))} off`}
                            </span>
                        </button>
                    </div>

                    <footer className="border-t border-white/5 p-4">
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={saving || !amountsMatch}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sp-primary px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {saving ? "Saving changes..." : (
                                <>
                                    <Check size={18} />
                                    Save changes
                                </>
                            )}
                        </button>
                    </footer>
                </div>
            </div>

            {/* Split amount sheet */}
            {showSplitSheet && (
                <div
                    className="fixed inset-0 z-[120] flex items-end bg-black/70 sm:items-center sm:justify-center"
                    onClick={() => setShowSplitSheet(false)}
                >
                    <div
                        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-sp-bg sm:max-w-xl sm:rounded-[28px]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                            <button
                                type="button"
                                onClick={() => setShowSplitSheet(false)}
                                className="flex h-10 w-10 items-center justify-center text-sp-muted"
                                aria-label="Close split amounts"
                            >
                                <X size={22} />
                            </button>
                            <div className="text-center">
                                <h2 className="font-medium">Split amounts</h2>
                                <p className="text-xs text-sp-muted">
                                    Total ₹{money(total)}
                                </p>
                            </div>
                            <div className="w-10" />
                        </header>

                        <div className="min-h-0 flex-1 overflow-y-auto p-4">
                            {/* Split mode */}
                            <div className="grid grid-cols-3 rounded-2xl bg-sp-surface p-1">
                                <button
                                    type="button"
                                    onClick={selectEqualMode}
                                    className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${splitMode === "equal"
                                        ? "bg-sp-primary text-white"
                                        : "text-sp-muted hover:text-white"
                                        }`}
                                >
                                    Equal
                                </button>

                                <button
                                    type="button"
                                    onClick={selectAmountMode}
                                    className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${splitMode === "amount"
                                        ? "bg-sp-primary text-white"
                                        : "text-sp-muted hover:text-white"
                                        }`}
                                >
                                    Amount
                                </button>

                                <button
                                    type="button"
                                    onClick={selectPercentageMode}
                                    className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${splitMode === "percentage"
                                        ? "bg-sp-primary text-white"
                                        : "text-sp-muted hover:text-white"
                                        }`}
                                >
                                    %
                                </button>
                            </div>

                            {splitMode === "equal" && (
                                <p className="mt-3 text-center text-xs text-sp-muted">
                                    The total is divided equally. The final person
                                    receives any rounding difference.
                                </p>
                            )}

                            {splitMode === "amount" && (
                                <p className="mt-3 text-center text-xs text-sp-muted">
                                    Enter an amount or an expression like{" "}
                                    <span className="text-white/70">
                                        100+20-5
                                    </span>
                                    .
                                </p>
                            )}

                            {splitMode === "percentage" && (
                                <p className="mt-3 text-center text-xs text-sp-muted">
                                    Enter percentages that add up to 100%.
                                </p>
                            )}

                            <div className="mt-5 space-y-3">
                                {currentForm.splits.map((split) => {
                                    const name =
                                        split.user_name ||
                                        split.contact_name ||
                                        "Unknown";
                                    const locked = isLocked(split);
                                    const evaluatedAmount =
                                        calculateExpression(split.amount);
                                    const evaluatedPercentage =
                                        calculateExpression(split.percentage);
                                    const isInvalidAmount =
                                        split.amount.trim() !== "" &&
                                        (evaluatedAmount === null ||
                                            evaluatedAmount < 0);
                                    const isInvalidPercentage =
                                        split.percentage.trim() !== "" &&
                                        (evaluatedPercentage === null ||
                                            evaluatedPercentage < 0);
                                    const remaining = Math.max(
                                        0,
                                        (evaluatedAmount ?? 0) -
                                        split.settled_amount
                                    );

                                    return (
                                        <div
                                            key={split.id}
                                            className="rounded-2xl bg-sp-surface p-4"
                                        >
                                            <div className="mb-3 flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium">
                                                        {split.user !== null ? "ME" : name}
                                                    </p>
                                                    <p className="mt-1 text-xs text-sp-muted">
                                                        {keyOf(split) === selectedPayerKey
                                                            ? "Payer"
                                                            : split.user !== null
                                                                ? "You"
                                                                : "Contact"}
                                                        {locked ? " · settlement locked" : ""}
                                                    </p>
                                                </div>
                                                {locked && (
                                                    <LockKeyhole
                                                        size={16}
                                                        className="text-amber-300"
                                                    />
                                                )}
                                            </div>

                                            {splitMode === "percentage" ? (
                                                <>
                                                    <div className="relative">
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sp-muted">
                                                            %
                                                        </span>

                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={split.percentage}
                                                            readOnly={locked}
                                                            onChange={(event) =>
                                                                updateSplitPercentage(
                                                                    split,
                                                                    event.target.value
                                                                )
                                                            }
                                                            placeholder="0"
                                                            className={`w-full rounded-xl bg-sp-bg py-3 pl-4 pr-10 text-white outline-none placeholder:text-sp-muted focus:ring-2 focus:ring-sp-primary ${locked
                                                                ? "cursor-default opacity-50"
                                                                : ""
                                                                } ${isInvalidPercentage
                                                                    ? "ring-1 ring-red-400"
                                                                    : ""
                                                                }`}
                                                        />
                                                    </div>

                                                    <div className="mt-2 flex justify-between text-xs">
                                                        <span className="text-sp-muted">
                                                            Amount
                                                        </span>
                                                        <span className="tabular-nums text-white/70">
                                                            ₹
                                                            {money(
                                                                Math.max(
                                                                    evaluatedAmount ?? 0,
                                                                    0
                                                                )
                                                            )}
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sp-muted">
                                                        ₹
                                                    </span>

                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={split.amount}
                                                        readOnly={
                                                            splitMode === "equal" ||
                                                            locked
                                                        }
                                                        onChange={(event) =>
                                                            updateSplitAmount(
                                                                split,
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="0.00"
                                                        className={`w-full rounded-xl bg-sp-bg py-3 pl-9 pr-4 text-white outline-none placeholder:text-sp-muted focus:ring-2 focus:ring-sp-primary ${splitMode === "equal" || locked
                                                            ? "cursor-default"
                                                            : ""
                                                            } ${locked
                                                                ? "opacity-50"
                                                                : ""
                                                            } ${isInvalidAmount
                                                                ? "ring-1 ring-red-400"
                                                                : ""
                                                            }`}
                                                    />
                                                </div>
                                            )}

                                            {isInvalidAmount &&
                                                splitMode !== "percentage" && (
                                                    <p className="mt-2 text-xs text-red-400">
                                                        Invalid amount expression.
                                                    </p>
                                                )}

                                            {locked && (
                                                <p className="mt-2 text-xs text-amber-300/75">
                                                    Settled ₹{money(split.settled_amount)} ·
                                                    Remaining ₹{money(remaining)}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {splitMode === "percentage" && (
                                <div className="mt-4 rounded-2xl bg-sp-surface p-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-sp-muted">
                                            Percentage
                                        </span>
                                        <span
                                            className={
                                                percentagesMatch &&
                                                    !hasInvalidPercentage
                                                    ? "text-sp-success"
                                                    : "text-red-400"
                                            }
                                        >
                                            {money(totalPercentage)}%
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 rounded-2xl bg-sp-surface p-4">
                                <div className="flex justify-between py-1 text-sm">
                                    <span className="text-sp-muted">Total</span>
                                    <span>₹{money(total)}</span>
                                </div>
                                <div className="flex justify-between py-1 text-sm">
                                    <span className="text-sp-muted">Assigned</span>
                                    <span>₹{money(assigned)}</span>
                                </div>
                                <div className="flex justify-between py-1 text-sm">
                                    <span className="text-sp-muted">
                                        {amountsMatch
                                            ? "Status"
                                            : difference > 0.005
                                                ? "Over by"
                                                : "Remaining"}
                                    </span>
                                    <span
                                        className={
                                            amountsMatch
                                                ? "text-emerald-300"
                                                : "text-red-300"
                                        }
                                    >
                                        {amountsMatch
                                            ? "Matched"
                                            : `₹${money(Math.abs(difference))}`}
                                    </span>
                                </div>

                                {invalidAmount && (
                                    <p className="mt-3 text-xs text-red-400">
                                        Fix the invalid split amount before
                                        saving.
                                    </p>
                                )}
                            </div>
                        </div>

                        <footer className="border-t border-white/5 p-4">
                            <button
                                type="button"
                                onClick={() => setShowSplitSheet(false)}
                                className="w-full rounded-2xl bg-sp-primary px-5 py-3.5 font-semibold text-white"
                            >
                                Done
                            </button>
                        </footer>
                    </div>
                </div>
            )}


            {/* Amount keypad */}
            {keypadTarget !== null && (
                <div
                    className="fixed inset-0 z-[140] flex items-end bg-transparent"
                    onClick={() => setKeypadTarget(null)}
                >
                    <div
                        className="relative z-[141] w-full overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#202124] shadow-[0_-12px_40px_rgba(0,0,0,0.35)] animate-in slide-in-from-bottom duration-200"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3">
                            <p className="text-sm font-medium text-white/65">
                                {keypadTarget.type === "total"
                                    ? "Transaction amount"
                                    : "Split amount"}
                            </p>

                            <button
                                type="button"
                                onClick={() => setKeypadTarget(null)}
                                className="rounded-full px-3 py-1.5 text-sm font-medium text-sp-primary transition hover:bg-white/5 active:scale-95"
                            >
                                Done
                            </button>
                        </div>

                        {/* Keypad */}
                        <AmountKeypad
                            value={keypadValue()}
                            onChange={changeKeypadValue}
                            confirmLabel="="
                        />
                    </div>
                </div>
            )}

        </>
    );
}