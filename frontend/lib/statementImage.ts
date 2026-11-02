import {
    statementHeading,
    statementLines,
    statementTotal,
    type StatementInput,
} from "@/lib/statement";

// Layout in CSS pixels; drawn at 2x so it stays sharp when zoomed in WhatsApp.
const WIDTH = 540;
const PAD = 24;
const INSET = 16;
const LIST_TOP = 124;
const ROW_HEIGHT = 64;
const TOTAL_HEIGHT = 64;
const FOOTER_HEIGHT = 48;

type TextOptions = {
    weight?: number;
    size?: number;
    fill: string;
    align?: CanvasTextAlign;
    maxWidth?: number;
};

/** Cuts `value` down with an ellipsis until it fits `maxWidth`. */
function fit(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
    if (ctx.measureText(value).width <= maxWidth) return value;
    let end = value.length;
    while (end > 0 && ctx.measureText(`${value.slice(0, end)}…`).width > maxWidth) end--;
    return `${value.slice(0, end).trimEnd()}…`;
}

/** Draws the statement as a phone-width card and returns it as a PNG. */
export async function renderStatementImage(input: StatementInput): Promise<Blob> {
    // Read the theme and the next/font family from the page so the image matches the app.
    const theme = getComputedStyle(document.documentElement);
    const color = (name: string) => theme.getPropertyValue(`--sp-${name}`).trim();
    const family = getComputedStyle(document.body).fontFamily;
    const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;
    // allSettled: loading rejects outright when any face in the stack fails, e.g.
    // next/font's "Geist Fallback" on devices without the local font it wraps.
    // Drawing then just falls back to the next family in the stack.
    await Promise.allSettled(
        [400, 500, 600, 700].map((weight) => document.fonts.load(font(weight, 16)))
    );

    const lines = statementLines(input);
    const { title, subtitle } = statementHeading(input);
    const total = statementTotal(input);

    const listHeight = Math.max(lines.length, 1) * ROW_HEIGHT;
    const totalTop = LIST_TOP + listHeight + 16;
    const height = totalTop + TOTAL_HEIGHT + FOOTER_HEIGHT;

    // Browsers cap canvas size (iOS at ~16.7M pixels), so long statements drop below 2x.
    const scale = Math.min(2, 16000 / height, Math.sqrt(16_000_000 / (WIDTH * height)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(WIDTH * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported");
    ctx.scale(scale, scale);

    /** Draws one line of text and returns its width. */
    function text(value: string, x: number, y: number, options: TextOptions) {
        const { weight = 400, size = 14, fill, align = "left", maxWidth } = options;
        ctx!.font = font(weight, size);
        ctx!.fillStyle = fill;
        ctx!.textAlign = align;
        const shown = maxWidth ? fit(ctx!, value, maxWidth) : value;
        ctx!.fillText(shown, x, y);
        return ctx!.measureText(shown).width;
    }

    ctx.fillStyle = color("bg");
    ctx.fillRect(0, 0, WIDTH, height);

    text("SpendLog", PAD, 38, { weight: 700, fill: color("primary-soft") });
    text(title, PAD, 74, { weight: 600, size: 22, fill: color("text"), maxWidth: WIDTH - PAD * 2 });
    text(subtitle, PAD, 100, { fill: color("muted"), maxWidth: WIDTH - PAD * 2 });

    ctx.fillStyle = color("card");
    ctx.beginPath();
    ctx.roundRect(PAD, LIST_TOP, WIDTH - PAD * 2, listHeight, 14);
    ctx.fill();

    const left = PAD + INSET;
    const right = WIDTH - PAD - INSET;

    if (!lines.length) {
        text("No transactions.", WIDTH / 2, LIST_TOP + 38, {
            fill: color("muted"),
            align: "center",
        });
    }

    lines.forEach((line, i) => {
        const top = LIST_TOP + i * ROW_HEIGHT;

        if (i > 0) {
            ctx.fillStyle = color("border");
            ctx.fillRect(left, top, right - left, 1);
        }

        // Green when I paid or lent (they owe me), red when they did.
        const amountColor = line.settledTick
            ? color("muted")
            : color(line.byMe ? "success" : "danger");
        const amountWidth = text(line.amount, right, top + 28, {
            weight: 600,
            size: 16,
            fill: amountColor,
            align: "right",
        });

        const status = line.settledTick
            ? { label: "✓ Settled", fill: color("muted") }
            : line.remaining
              ? { label: `${line.remaining} left`, fill: color("warning") }
              : null;
        const statusWidth = status
            ? text(status.label, right, top + 48, { size: 12, fill: status.fill, align: "right" })
            : 0;

        text(line.note, left, top + 28, {
            weight: 500,
            size: 15,
            fill: color("text"),
            maxWidth: right - left - amountWidth - 16,
        });
        text(`${line.day} · ${line.action} by ${line.byMe ? "me" : "you"}`, left, top + 48, {
            size: 12,
            fill: color("muted"),
            maxWidth: right - left - statusWidth - 16,
        });
    });

    ctx.fillStyle = color("primary-deep");
    ctx.beginPath();
    ctx.roundRect(PAD, totalTop, WIDTH - PAD * 2, TOTAL_HEIGHT, 14);
    ctx.fill();

    const totalColor = {
        positive: color("success"),
        negative: color("danger"),
        neutral: color("text"),
    }[total.tone];
    const valueWidth = text(total.value, right, totalTop + 38, {
        weight: 700,
        size: 18,
        fill: totalColor,
        align: "right",
    });
    text(total.label, left, totalTop + 38, {
        weight: 500,
        fill: color("primary-soft"),
        maxWidth: right - left - valueWidth - 16,
    });

    const today = new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
    text(`Shared from SpendLog · ${today}`, WIDTH / 2, totalTop + TOTAL_HEIGHT + 30, {
        size: 12,
        fill: color("muted"),
        align: "center",
    });

    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't create the image"))),
            "image/png"
        )
    );
}
