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

export type StatementInput = {
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

export type StatementLine = {
    day: string;
    note: string;
    /** Written from the sender's side: "me" is the user, "you" is the contact. */
    byMe: boolean;
    action: "Paid" | "Lent";
    amount: string;
    /** Set when the row is partly settled. */
    remaining: string | null;
    /** Marks settled rows when the statement mixes settled and unsettled. */
    settledTick: boolean;
};

/** The rows ready to print, oldest first so they read like a statement. */
export function statementLines({ rows, status }: StatementInput): StatementLine[] {
    return [...rows].reverse().map((row) => {
        const date = new Date(row.date);
        return {
            day: formatDay(date, date.getFullYear() !== new Date().getFullYear()),
            note: row.note.trim() || "No note",
            byMe: row.type === "individual" ? row.direction === "lend" : row.amount > 0,
            action: row.type === "individual" ? "Lent" : "Paid",
            amount: money(row.amount),
            remaining:
                !row.settled && row.settled_amount > 0 ? money(row.remaining_amount) : null,
            settledTick: row.settled && status === "all",
        };
    });
}

export function statementHeading({ contactName, status, from, to }: StatementInput) {
    return {
        title: `Expenses with ${contactName}`,
        subtitle: `${rangeLabel(from, to)} · ${statusLabels[status]}`,
    };
}

export function statementTotal({ status, rows, balance }: StatementInput) {
    if (status === "settled") {
        const total = rows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
        return { label: "Total settled", value: money(total), tone: "neutral" } as const;
    }
    if (balance > 0) {
        return { label: "Net Result", value: `You owe me ${money(balance)}`, tone: "positive" } as const;
    }
    if (balance < 0) {
        return { label: "Net Result", value: `I owe you ${money(balance)}`, tone: "negative" } as const;
    }
    return { label: "Net Result", value: "All settled up", tone: "neutral" } as const;
}

const headers = ["Date", "Item / Description", "Paid/Lent by Me", "Paid/Lent by You"];
const columnGap = "  ";

function rowCells(line: StatementLine, amountWidth: number) {
    const detail = line.remaining ? `${line.action}, ${line.remaining} left` : line.action;
    const tick = line.settledTick ? " ✓" : "";
    const cell = `${line.amount.padEnd(amountWidth)} (${detail})${tick}`;

    return [line.day, line.note, line.byMe ? cell : "-", line.byMe ? "-" : cell];
}

/** Bold header, then the rows as a table in a WhatsApp monospace (```) block. */
export function buildStatementMessage(input: StatementInput) {
    const rows = statementLines(input);
    const { title, subtitle } = statementHeading(input);
    const total = statementTotal(input);

    // Pad amounts to one width so the "(Paid)" / "(Lent)" labels line up.
    const amountWidth = Math.max(0, ...rows.map((line) => line.amount.length));
    const table = [headers, ...rows.map((line) => rowCells(line, amountWidth))];
    const widths = headers.map((_, i) => Math.max(...table.map((cells) => cells[i].length)));

    const lines = table.map((cells) =>
        cells.map((cell, i) => cell.padEnd(widths[i])).join(columnGap).trimEnd()
    );
    const rule = "-".repeat(
        widths.reduce((sum, width) => sum + width, 0) + columnGap.length * (widths.length - 1)
    );

    return [
        `*${title}*`,
        subtitle,
        "",
        "```",
        lines[0],
        rule,
        ...(rows.length ? lines.slice(1) : ["No transactions."]),
        rule,
        `${total.label}: ${total.value}`,
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
