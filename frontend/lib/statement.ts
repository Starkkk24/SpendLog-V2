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

const headers = ["Date", "Item / Description", "Paid/Lent by Me", "Paid/Lent by You"];
const columnGap = "  ";

function rowCells(row: StatementRow, status: StatementStatus, amountWidth: number) {
    const date = new Date(row.date);
    const day = formatDay(date, date.getFullYear() !== new Date().getFullYear());

    // Written from the sender's side: "Me" is the user, "You" is the contact.
    const byMe =
        row.type === "individual" ? row.direction === "lend" : row.amount > 0;
    const action = row.type === "individual" ? "Lent" : "Paid";

    const partial = !row.settled && row.settled_amount > 0;
    const detail = partial ? `${action}, ${money(row.remaining_amount)} left` : action;
    const tick = row.settled && status === "all" ? " ✓" : "";
    const cell = `${money(row.amount).padEnd(amountWidth)} (${detail})${tick}`;

    return [
        day,
        row.note.trim() || "No note",
        byMe ? cell : "-",
        byMe ? "-" : cell,
    ];
}

function totalLine({ status, rows, balance }: StatementInput) {
    if (status === "settled") {
        const total = rows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
        return `Total settled: ${money(total)}`;
    }
    if (balance > 0) return `Net Result: You owe me ${money(balance)}`;
    if (balance < 0) return `Net Result: I owe you ${money(balance)}`;
    return "Net Result: All settled up";
}

/** Bold header, then the rows as a table in a WhatsApp monospace (```) block. */
export function buildStatementMessage(input: StatementInput) {
    // Oldest first reads like a statement.
    const rows = [...input.rows].reverse();

    // Pad amounts to one width so the "(Paid)" / "(Lent)" labels line up.
    const amountWidth = Math.max(0, ...rows.map((row) => money(row.amount).length));
    const table = [headers, ...rows.map((row) => rowCells(row, input.status, amountWidth))];
    const widths = headers.map((_, i) => Math.max(...table.map((cells) => cells[i].length)));

    const lines = table.map((cells) =>
        cells.map((cell, i) => cell.padEnd(widths[i])).join(columnGap).trimEnd()
    );
    const rule = "-".repeat(
        widths.reduce((sum, width) => sum + width, 0) + columnGap.length * (widths.length - 1)
    );

    return [
        `*Expenses with ${input.contactName}*`,
        `${rangeLabel(input.from, input.to)} · ${statusLabels[input.status]}`,
        "",
        "```",
        lines[0],
        rule,
        ...(rows.length ? lines.slice(1) : ["No transactions."]),
        rule,
        totalLine(input),
        "```",
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
