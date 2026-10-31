import type { StatementStatus } from "@/services/balance";

export type StatementRow = {
    type: "expense" | "individual";
    direction?: "lend" | "borrow";
    /** Positive when the contact owes the user. */
    amount: number;
    settled_amount: number;
    remaining_amount: number;
    settled: boolean;
    date: string;
    note: string;
};

type StatementInput = {
    contactName: string;
    status: StatementStatus;
    /** Local "YYYY-MM-DD" values from the date inputs; empty means open-ended. */
    from: string;
    to: string;
    rows: StatementRow[];
    balance: number;
};

const statusLabels: Record<StatementStatus, string> = {
    unsettled: "Unsettled",
    settled: "Settled",
    all: "All transactions",
};

function money(value: number) {
    const amount = Math.abs(value);
    // ₹800, but ₹120.50 rather than ₹120.5.
    const digits = Number.isInteger(amount) ? 0 : 2;
    return `₹${amount.toLocaleString("en-IN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}`;
}

function formatDay(date: Date, withYear: boolean) {
    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        ...(withYear && { year: "numeric" }),
    });
}

function localDay(value: string) {
    return new Date(`${value}T00:00`);
}

function rangeLabel(from: string, to: string) {
    if (from && to) {
        const start = localDay(from);
        const end = localDay(to);
        const sameYear = start.getFullYear() === end.getFullYear();
        return `${formatDay(start, !sameYear)} – ${formatDay(end, true)}`;
    }
    if (from) return `From ${formatDay(localDay(from), true)}`;
    if (to) return `Until ${formatDay(localDay(to), true)}`;
    return "All dates";
}

function rowLine(row: StatementRow, status: StatementStatus) {
    const date = new Date(row.date);
    const day = formatDay(date, date.getFullYear() !== new Date().getFullYear());

    // Written from the sender's side: "I" is the user, "you" is the contact.
    const who =
        row.type === "individual"
            ? row.direction === "lend" ? "I lent" : "you lent"
            : row.amount > 0 ? "I paid" : "you paid";

    const partial = !row.settled && row.settled_amount > 0;
    const detail = partial ? `${who}, ${money(row.remaining_amount)} left` : who;
    const tick = row.settled && status === "all" ? " ✓" : "";

    return `${day} · ${row.note.trim() || "No note"} · ${money(row.amount)} (${detail})${tick}`;
}

function totalLine({ status, rows, balance }: StatementInput) {
    if (status === "settled") {
        const total = rows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
        return `*Total settled: ${money(total)}*`;
    }
    if (balance > 0) return `*Net: You owe me ${money(balance)}*`;
    if (balance < 0) return `*Net: I owe you ${money(balance)}*`;
    return "*Net: All settled up*";
}

/** Plain-text statement using WhatsApp's own formatting (`*bold*`). */
export function buildStatementMessage(input: StatementInput) {
    // Oldest first reads like a statement.
    const rows = [...input.rows].reverse();

    return [
        `*Expenses with ${input.contactName}*`,
        `${rangeLabel(input.from, input.to)} · ${statusLabels[input.status]}`,
        "",
        ...(rows.length ? rows.map((row) => rowLine(row, input.status)) : ["No transactions."]),
        "",
        totalLine(input),
    ].join("\n");
}

/** The backend wants absolute bounds: start of `from`, start of the day after `to`. */
export function statementBounds(from: string, to: string) {
    const end = to ? localDay(to) : null;
    end?.setDate(end.getDate() + 1);

    return {
        from: from ? localDay(from).toISOString() : undefined,
        to: end ? end.toISOString() : undefined,
    };
}
