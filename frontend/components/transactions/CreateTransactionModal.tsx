"use client";



import { useEffect, useRef, useState } from "react";

import AmountKeypad from "@/components/ui/AmountKeypad";

import {

    CalendarDays,

    ChevronLeft,

    ChevronRight,

    Clock3,

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



type SplitMode = "equal" | "amount" | "percentage";



type Participant = {

    type: "user" | "contact";

    id: number;

    name: string;

    amount: string;

    percentage: string;

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



function evaluateExpression(expression: string): number | null {

    const input = expression.replace(/\s+/g, "");

    if (!input) return null;



    if (!/^[0-9+\-*/().]+$/.test(input)) {

        return null;

    }



    let index = 0;



    function parseExpression(): number | null {

        let value = parseTerm();



        if (value === null) return null;



        while (index < input.length) {

            const operator = input[index];



            if (operator !== "+" && operator !== "-") {

                break;

            }



            index += 1;



            const right = parseTerm();

            if (right === null) return null;



            value = operator === "+" ? value + right : value - right;

        }



        return value;

    }



    function parseTerm(): number | null {

        let value = parseFactor();



        if (value === null) return null;



        while (index < input.length) {

            const operator = input[index];



            if (operator !== "*" && operator !== "/") {

                break;

            }



            index += 1;



            const right = parseFactor();

            if (right === null) return null;



            if (operator === "/" && right === 0) {

                return null;

            }



            value = operator === "*" ? value * right : value / right;

        }



        return value;

    }



    function parseFactor(): number | null {

        if (index >= input.length) return null;



        if (input[index] === "+" || input[index] === "-") {

            const sign = input[index] === "-" ? -1 : 1;

            index += 1;



            const value = parseFactor();

            return value === null ? null : sign * value;

        }



        if (input[index] === "(") {

            index += 1;



            const value = parseExpression();



            if (input[index] !== ")") {

                return null;

            }



            index += 1;

            return value;

        }



        const start = index;



        while (

            index < input.length &&

            /[0-9.]/.test(input[index])

        ) {

            index += 1;

        }



        if (start === index) return null;



        const number = Number(input.slice(start, index));



        return Number.isFinite(number) ? number : null;

    }



    const result = parseExpression();



    if (result === null || index !== input.length) {

        return null;

    }



    return Number.isFinite(result) ? result : null;

}



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

            (baseCents +

                (index < remainderCents ? 1 : 0)) /

            100

        ).toFixed(2)

    );

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



    const [splitMode, setSplitMode] =

        useState<SplitMode>("equal");



    const [showNewContact, setShowNewContact] =

        useState(false);



    const [newContactName, setNewContactName] =

        useState("");



    const [creating, setCreating] =

        useState(false);


    const [manualAmountKeys, setManualAmountKeys] =

        useState<Set<string>>(new Set());



    const [manualPercentageKeys, setManualPercentageKeys] =

        useState<Set<string>>(new Set());



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

                percentage: "",

            },

        ]);

    }, [user]);



    const transactionTotal =

        evaluateExpression(amount) ?? 0;



    const evaluatedParticipantAmounts =

        participants.map((participant) =>

            evaluateExpression(participant.amount)

        );



    const hasInvalidParticipantAmount =

        evaluatedParticipantAmounts.some(

            (value) => value === null || value < 0

        );


    const assignedTotal: number =
        evaluatedParticipantAmounts.reduce<number>(
            (sum: number, value: number | null) =>
                sum + (value ?? 0),
            0
        );



    const remaining =

        transactionTotal - assignedTotal;



    const totalPercentage =

        participants.reduce(

            (sum, participant) =>

                sum +

                (evaluateExpression(

                    participant.percentage

                ) ?? 0),

            0

        );



    const percentagesMatch =

        Math.abs(totalPercentage - 100) < 0.005;



    const amountsMatch =

        transactionTotal > 0 &&

        !hasInvalidParticipantAmount &&

        Math.abs(remaining) < 0.005 &&

        (splitMode !== "percentage" || percentagesMatch);





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

                    percentage: "",

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

                    percentage: "",

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

        const key = `${type}:${id}`;
        setManualAmountKeys((current) => {
            const next = new Set(current);
            next.add(key);
            return next;
        });

        setParticipants((current) => {
            const editedIndex = current.findIndex(
                (participant) =>
                    participant.type === type &&
                    participant.id === id
            );

            if (editedIndex === -1) return current;

            const editedAmount = evaluateExpression(value);

            const next = current.map((participant, index) =>
                index === editedIndex
                    ? { ...participant, amount: value }
                    : participant
            );

            if (
                editedAmount === null ||
                editedAmount < 0 ||
                current.length <= 1
            ) {
                return next;
            }

            const totalCents = Math.round(
                transactionTotal * 100
            );

            const editedCents = Math.round(
                editedAmount * 100
            );

            const manualKeys = new Set(manualAmountKeys);
            manualKeys.add(key);

            const adjustableIndices = current
                .map((participant, index) => ({
                    participant,
                    index,
                }))
                .filter(
                    ({ participant, index }) =>
                        index !== editedIndex &&
                        !manualKeys.has(
                            `${participant.type}:${participant.id}`
                        )
                )
                .map(({ index }) => index);

            // If there are no automatic participants left,
            // adjust the other participant closest to the end.
            const targetIndices =
                adjustableIndices.length > 0
                    ? adjustableIndices
                    : current
                        .map((_, index) => index)
                        .filter(
                            (index) => index !== editedIndex
                        )
                        .slice(-1);

            if (targetIndices.length === 0) {
                return next;
            }

            const preservedCents = current.reduce(
                (sum, participant, index) => {
                    if (index === editedIndex) return sum;

                    const participantKey =
                        `${participant.type}:${participant.id}`;

                    if (targetIndices.includes(index)) {
                        return sum;
                    }

                    return (
                        sum +
                        Math.round(
                            (evaluateExpression(
                                participant.amount
                            ) ?? 0) * 100
                        )
                    );
                },
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
                remainingCents -
                baseCents * targetIndices.length;

            return next.map((participant, index) => {
                const targetPosition =
                    targetIndices.indexOf(index);

                if (targetPosition === -1) {
                    return participant;
                }

                const cents =
                    baseCents +
                    (targetPosition < remainderCents ? 1 : 0);

                return {
                    ...participant,
                    amount: (cents / 100).toFixed(2),
                };
            });
        });
    }

    function updateParticipantPercentage(
        type: "user" | "contact",
        id: number,
        value: string
    ) {

        const key = `${type}:${id}`;
        setManualPercentageKeys((current) => {
            const next = new Set(current);
            next.add(key);
            return next;
        });

        setParticipants((current) => {
            const editedIndex = current.findIndex(
                (participant) =>
                    participant.type === type &&
                    participant.id === id
            );

            if (editedIndex === -1) return current;

            const editedPercentage =
                evaluateExpression(value);

            const next = current.map((participant, index) =>
                index === editedIndex
                    ? {
                        ...participant,
                        percentage: value,
                    }
                    : participant
            );

            if (
                editedPercentage === null ||
                editedPercentage < 0 ||
                current.length <= 1
            ) {
                return next;
            }

            const manualKeys = new Set(
                manualPercentageKeys
            );
            manualKeys.add(key);

            const adjustableIndices = current
                .map((participant, index) => ({
                    participant,
                    index,
                }))
                .filter(
                    ({ participant, index }) =>
                        index !== editedIndex &&
                        !manualKeys.has(
                            `${participant.type}:${participant.id}`
                        )
                )
                .map(({ index }) => index);

            const targetIndices =
                adjustableIndices.length > 0
                    ? adjustableIndices
                    : current
                        .map((_, index) => index)
                        .filter(
                            (index) => index !== editedIndex
                        )
                        .slice(-1);

            if (targetIndices.length === 0) {
                return next;
            }

            const totalBasisPoints = 10000;
            const editedBasisPoints = Math.round(
                editedPercentage * 100
            );

            const preservedBasisPoints = current.reduce(
                (sum, participant, index) => {
                    if (index === editedIndex) return sum;

                    if (targetIndices.includes(index)) {
                        return sum;
                    }

                    return (
                        sum +
                        Math.round(
                            (evaluateExpression(
                                participant.percentage
                            ) ?? 0) * 100
                        )
                    );
                },
                editedBasisPoints
            );

            const remainingBasisPoints = Math.max(
                totalBasisPoints -
                preservedBasisPoints,
                0
            );

            const baseBasisPoints = Math.floor(
                remainingBasisPoints / targetIndices.length
            );

            const remainderBasisPoints =
                remainingBasisPoints -
                baseBasisPoints * targetIndices.length;

            return next.map((participant, index) => {
                const targetPosition =
                    targetIndices.indexOf(index);

                if (index === editedIndex) {
                    return {
                        ...participant,
                        amount: (
                            transactionTotal *
                            editedPercentage /
                            100
                        ).toFixed(2),
                    };
                }

                if (targetPosition === -1) {
                    return participant;
                }

                const basisPoints =
                    baseBasisPoints +
                    (targetPosition < remainderBasisPoints
                        ? 1
                        : 0);

                const percentage = basisPoints / 100;

                return {
                    ...participant,
                    percentage: percentage.toFixed(2),
                    amount: (
                        transactionTotal *
                        percentage /
                        100
                    ).toFixed(2),
                };
            });
        });
    }

    function applyEqualSplit() {

        if (
            participants.length === 0 ||
            transactionTotal <= 0
        ) {
            return;
        }

        const amounts = splitIntoEqualAmounts(
            transactionTotal,
            participants.length
        );

        setManualAmountKeys(new Set());
        setManualPercentageKeys(new Set());

        setParticipants((current) =>
            current.map((participant, index) => ({
                ...participant,
                amount: amounts[index] ?? "0.00",
                percentage: (
                    100 / current.length
                ).toFixed(2),
            }))
        );

        setSplitMode("equal");
    }


    function openSplitSheet() {

        setShowSplitSheet(true);
        setSplitMode("equal");
        setManualAmountKeys(new Set());
        setManualPercentageKeys(new Set());

        if (participants.length === 0 || transactionTotal <= 0) {
            return;
        }

        const amounts = splitIntoEqualAmounts(
            transactionTotal,
            participants.length
        );

        setParticipants((current) =>
            current.map((participant, index) => ({
                ...participant,
                amount: amounts[index] ?? "0.00",
                percentage: (
                    100 / current.length
                ).toFixed(2),
            }))
        );
    }

    useEffect(() => {
        if (
            !showSplitSheet ||
            splitMode !== "equal" ||
            participants.length === 0 ||
            transactionTotal <= 0
        ) {
            return;
        }

        const amounts = splitIntoEqualAmounts(
            transactionTotal,
            participants.length
        );

        setParticipants((current) => {
            const needsUpdate = current.some(
                (participant, index) =>
                    participant.amount !==
                    amounts[index]
            );

            if (!needsUpdate) {
                return current;
            }

            return current.map((participant, index) => ({
                ...participant,
                amount: amounts[index] ?? "0.00",
                percentage: (
                    100 / current.length
                ).toFixed(2),
            }));
        });
    }, [
        showSplitSheet,
        splitMode,
        transactionTotal,
        participants.length,
    ]);

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

                    percentage: "",

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



        if (hasInvalidParticipantAmount) {

            alert(

                "One or more split amounts contain an invalid expression."

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



            total_amount: transactionTotal.toFixed(2),



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



                    amount: (

                        evaluateExpression(

                            participant.amount

                        ) ?? 0

                    ).toFixed(2),

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

                    {/* KEYPAD */}

                    <div className="relative shrink-0 border-t border-white/5 bg-[#202124]">
                        <AmountKeypad
                            value={amount}
                            onChange={setAmount}
                            confirmLabel="="
                        />

                        <button
                            type="button"
                            disabled={
                                !transactionTotal ||
                                participants.length === 0
                            }
                            onClick={() => setShowSplitSheet(true)}
                            className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-sp-primary text-white shadow-lg transition active:scale-95 disabled:opacity-30"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Participant count */}
                    {/* <div className="pointer-events-none absolute bottom-6 left-5 z-10 text-sp-muted">
                            <span className="text-xs">
                                {participants.length > 0
                                    ? `${participants.length} split${participants.length !== 1
                                        ? "s"
                                        : ""
                                    }`
                                    : ""}
                            </span>
                        </div> */}
                    {/* </div> */}

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
                    onClick={() => setShowSplitSheet(false)}
                >
                    <div
                        className="absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-[28px] bg-sp-bg p-5 pb-[max(20px,env(safe-area-inset-bottom))]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setShowSplitSheet(false)}
                                className="flex h-10 w-10 items-center justify-center text-sp-muted"
                                aria-label="Close split amounts"
                            >
                                <ChevronLeft size={22} />
                            </button>

                            <h2 className="text-lg font-medium">
                                Split amounts
                            </h2>

                            <div className="w-10" />
                        </div>

                        {/* Split mode */}
                        <div className="mt-5 grid grid-cols-3 rounded-2xl bg-sp-surface p-1">
                            <button
                                type="button"
                                onClick={applyEqualSplit}
                                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${splitMode === "equal"
                                    ? "bg-sp-primary text-white"
                                    : "text-sp-muted hover:text-white"
                                    }`}
                            >
                                Equal
                            </button>

                            <button
                                type="button"
                                onClick={() => setSplitMode("amount")}
                                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${splitMode === "amount"
                                    ? "bg-sp-primary text-white"
                                    : "text-sp-muted hover:text-white"
                                    }`}
                            >
                                Amount
                            </button>

                            <button
                                type="button"
                                onClick={() => setSplitMode("percentage")}
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
                            {participants.map((participant) => {
                                const evaluatedAmount =
                                    evaluateExpression(
                                        participant.amount
                                    );

                                const isInvalidAmount =
                                    participant.amount.trim() !== "" &&
                                    (
                                        evaluatedAmount === null ||
                                        evaluatedAmount < 0
                                    );

                                return (
                                    <div
                                        key={`${participant.type}-${participant.id}`}
                                        className="rounded-2xl bg-sp-surface p-4"
                                    >
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="font-medium">
                                                {participant.name}
                                            </span>

                                            <span className="text-xs text-sp-muted">
                                                {participant.type === "user"
                                                    ? "You"
                                                    : "Contact"}
                                            </span>
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
                                                        value={
                                                            participant.percentage
                                                        }
                                                        onChange={(e) =>
                                                            updateParticipantPercentage(
                                                                participant.type,
                                                                participant.id,
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="0"
                                                        className="w-full rounded-xl bg-sp-bg py-3 pl-4 pr-10 text-white outline-none placeholder:text-sp-muted focus:ring-2 focus:ring-sp-primary"
                                                    />
                                                </div>

                                                <div className="mt-2 flex justify-between text-xs">
                                                    <span className="text-sp-muted">
                                                        Amount
                                                    </span>
                                                    <span className="tabular-nums text-white/70">
                                                        ₹
                                                        {formatMoney(
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
                                                    value={participant.amount}
                                                    readOnly={
                                                        splitMode === "equal"
                                                    }
                                                    onChange={(e) =>
                                                        updateParticipantAmount(
                                                            participant.type,
                                                            participant.id,
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder="0.00"
                                                    className={`w-full rounded-xl bg-sp-bg py-3 pl-9 pr-4 text-white outline-none placeholder:text-sp-muted focus:ring-2 focus:ring-sp-primary ${splitMode === "equal"
                                                        ? "cursor-default"
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
                                            percentagesMatch
                                                ? "text-sp-success"
                                                : "text-red-400"
                                        }
                                    >
                                        {formatMoney(totalPercentage)}%
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Summary */}
                        <div className="mt-5 rounded-2xl bg-sp-surface p-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-sp-muted">
                                    Total
                                </span>

                                <span>
                                    ₹
                                    {formatMoney(transactionTotal)}
                                </span>
                            </div>

                            <div className="mt-2 flex justify-between text-sm">
                                <span className="text-sp-muted">
                                    Assigned
                                </span>

                                <span>
                                    ₹
                                    {formatMoney(assignedTotal)}
                                </span>
                            </div>

                            <div className="mt-2 flex justify-between text-sm">
                                <span className="text-sp-muted">
                                    {remaining < 0
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
                                        Math.abs(remaining)
                                    )}
                                </span>
                            </div>

                            {hasInvalidParticipantAmount && (
                                <p className="mt-3 text-xs text-red-400">
                                    Fix the invalid split amount before
                                    creating the transaction.
                                </p>
                            )}
                        </div>

                        <button
                            type="button"
                            disabled={
                                !amountsMatch ||
                                creating
                            }
                            onClick={handleCreateTransaction}
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



