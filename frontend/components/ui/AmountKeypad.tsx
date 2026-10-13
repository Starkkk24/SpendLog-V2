"use client";

import React, { useMemo } from "react";

type AmountKeypadProps = {
    value: string;
    onChange: (value: string) => void;
    onConfirm?: () => void;
    confirmLabel?: string;
    disabled?: boolean;
};

type Token =
    | { type: "number"; value: number }
    | { type: "operator"; value: "+" | "-" | "*" | "/" };

function tokenize(expression: string): Token[] | null {
    const input = expression.replace(/\s+/g, "");

    if (!input) {
        return null;
    }

    const tokens: Token[] = [];
    let number = "";

    const flushNumber = () => {
        if (!number) return;

        const parsed = Number(number);

        if (!Number.isFinite(parsed)) {
            throw new Error("Invalid number");
        }

        tokens.push({
            type: "number",
            value: parsed,
        });

        number = "";
    };

    for (let index = 0; index < input.length; index += 1) {
        const char = input[index];

        if (
            (char >= "0" && char <= "9") ||
            char === "."
        ) {
            number += char;
            continue;
        }

        if ("+-*/".includes(char)) {
            /*
             * Allow unary minus:
             *
             * -10
             * 100*-10
             * 100+-10
             */
            if (
                char === "-" &&
                number === "" &&
                (
                    tokens.length === 0 ||
                    tokens[tokens.length - 1].type === "operator"
                )
            ) {
                number = "-";
                continue;
            }

            flushNumber();

            if (
                tokens.length === 0 ||
                tokens[tokens.length - 1].type === "operator"
            ) {
                return null;
            }

            tokens.push({
                type: "operator",
                value: char as "+" | "-" | "*" | "/",
            });

            continue;
        }

        return null;
    }

    if (number === "-" || number === ".") {
        return null;
    }

    flushNumber();

    if (
        tokens.length === 0 ||
        tokens[tokens.length - 1].type === "operator"
    ) {
        return null;
    }

    return tokens;
}

function calculateExpression(
    expression: string
): number | null {
    try {
        const tokens = tokenize(expression);

        if (!tokens) {
            return null;
        }

        /*
         * First resolve × and ÷.
         */
        const intermediate: Token[] = [];

        let index = 0;

        while (index < tokens.length) {
            const token = tokens[index];

            if (
                token.type === "operator" &&
                (token.value === "*" ||
                    token.value === "/")
            ) {
                return null;
            }

            if (
                index + 1 < tokens.length &&
                tokens[index + 1].type === "operator" &&
                (
                    tokens[index + 1].value === "*" ||
                    tokens[index + 1].value === "/"
                )
            ) {
                let result =
                    token.type === "number"
                        ? token.value
                        : 0;

                let cursor = index + 1;

                while (
                    cursor < tokens.length &&
                    tokens[cursor].type === "operator" &&
                    (
                        tokens[cursor].value === "*" ||
                        tokens[cursor].value === "/"
                    )
                ) {
                    const operator =
                        tokens[cursor];

                    const next =
                        tokens[cursor + 1];

                    if (!next || next.type !== "number") {
                        return null;
                    }

                    if (
                        operator.value === "/" &&
                        next.value === 0
                    ) {
                        return null;
                    }

                    if (operator.value === "*") {
                        result *= next.value;
                    } else {
                        result /= next.value;
                    }

                    cursor += 2;
                }

                intermediate.push({
                    type: "number",
                    value: result,
                });

                if (cursor < tokens.length) {
                    const nextOperator = tokens[cursor];

                    if (
                        nextOperator.type === "operator" &&
                        (
                            nextOperator.value === "+" ||
                            nextOperator.value === "-"
                        )
                    ) {
                        intermediate.push(nextOperator);
                    }
                }

                index = cursor + 1;
                continue;
            }

            intermediate.push(token);
            index += 1;
        }

        /*
         * Then resolve + and -.
         */
        if (
            intermediate.length === 0 ||
            intermediate[0].type !== "number"
        ) {
            return null;
        }

        let result = intermediate[0].value;

        for (
            let i = 1;
            i < intermediate.length;
            i += 2
        ) {
            const operator = intermediate[i];
            const number = intermediate[i + 1];

            if (
                !operator ||
                operator.type !== "operator" ||
                !number ||
                number.type !== "number"
            ) {
                return null;
            }

            if (operator.value === "+") {
                result += number.value;
            } else if (operator.value === "-") {
                result -= number.value;
            } else {
                return null;
            }
        }

        if (!Number.isFinite(result)) {
            return null;
        }

        return result;
    } catch {
        return null;
    }
}

function formatResult(value: number): string {
    if (!Number.isFinite(value)) {
        return "";
    }

    const rounded =
        Math.round((value + Number.EPSILON) * 100000000) /
        100000000;

    return String(rounded);
}

function isOperator(value: string) {
    return ["+", "-", "*", "/"].includes(value);
}

function displayOperator(value: string) {
    if (value === "*") return "×";
    if (value === "/") return "÷";
    return value;
}

export default function AmountKeypad({
    value,
    onChange,
    onConfirm,
    confirmLabel = "✓",
    disabled = false,
}: AmountKeypadProps) {
    const result = useMemo(
        () => calculateExpression(value),
        [value]
    );

    function appendNumber(number: string) {
        if (disabled) return;

        const lastCharacter =
            value[value.length - 1];

        /*
         * Prevent multiple decimal points
         * inside the current number.
         */
        if (number === ".") {
            const currentNumber =
                value.split(/[+\-*/]/).pop() ?? "";

            if (currentNumber.includes(".")) {
                return;
            }
        }

        onChange(value + number);
    }

    function appendOperator(operator: string) {
        if (disabled) return;

        if (!value) {
            /*
             * Allow starting with minus.
             */
            if (operator === "-") {
                onChange("-");
            }

            return;
        }

        const lastCharacter =
            value[value.length - 1];

        if (isOperator(lastCharacter)) {
            /*
             * Replace an existing operator instead
             * of allowing ++, ×+, etc.
             */
            if (operator === "-") {
                /*
                 * Allow a negative number after an
                 * operator:
                 *
                 * 100 × -20
                 */
                onChange(value + "-");
            } else {
                onChange(
                    value.slice(0, -1) + operator
                );
            }

            return;
        }

        onChange(value + operator);
    }

    function handleBackspace() {
        if (disabled) return;

        onChange(value.slice(0, -1));
    }

    function handleToggleSign() {
        if (disabled) return;

        if (!value) {
            onChange("-");
            return;
        }

        /*
         * Toggle the sign of the last number.
         *
         * 100+20 → 100+-20
         * 100+-20 → 100+20
         * 20 → -20
         * -20 → 20
         */
        const match = value.match(
            /(^|[+\-*/])(-?\d*\.?\d*)$/
        );

        if (!match) {
            return;
        }

        const prefix = match[1];
        const number = match[2];

        if (!number) {
            return;
        }

        if (number.startsWith("-")) {
            onChange(
                value.slice(0, value.length - number.length) +
                number.slice(1)
            );
        } else {
            onChange(
                value.slice(0, value.length - number.length) +
                "-" +
                number
            );
        }
    }

    function handleConfirm() {
        if (disabled || result === null) {
            return;
        }

        onChange(formatResult(result));
        onConfirm?.();
    }

    const displayResult =
        result !== null
            ? formatResult(result)
            : null;

    return (
        <div className="w-full overflow-hidden rounded-t-[28px] bg-[#202124] text-white">
            {/* Live result */}
            {/* <div className="min-h-10 px-5 pt-2 text-right">
                {value && displayResult !== null && (
                    <p className="text-sm tabular-nums text-white/35">
                        = {displayResult}
                    </p>
                )}
            </div> */}

            {/* Keypad */}
            <div className="grid grid-cols-5">
                {/* Row 1 */}
                <Key
                    label="+"
                    onClick={() => appendOperator("+")}
                    disabled={disabled}
                />

                <Key
                    label="7"
                    onClick={() => appendNumber("7")}
                    disabled={disabled}
                />

                <Key
                    label="8"
                    onClick={() => appendNumber("8")}
                    disabled={disabled}
                />

                <Key
                    label="9"
                    onClick={() => appendNumber("9")}
                    disabled={disabled}
                />

                <Key
                    label="⌫"
                    onClick={handleBackspace}
                    disabled={disabled}
                />
                

                {/* Row 2 */}
                <Key
                    label="-"
                    onClick={() => appendOperator("-")}
                    disabled={disabled}
                />

                <Key
                    label="4"
                    onClick={() => appendNumber("4")}
                    disabled={disabled}
                />

                <Key
                    label="5"
                    onClick={() => appendNumber("5")}
                    disabled={disabled}
                />

                <Key
                    label="6"
                    onClick={() => appendNumber("6")}
                    disabled={disabled}
                />

                <Key
                    label="C"
                    onClick={() => onChange("")}
                    disabled={disabled}
                />


                {/* <div /> */}

                {/* Row 3 */}
                <Key
                    label="×"
                    onClick={() => appendOperator("*")}
                    disabled={disabled}
                />

                <Key
                    label="1"
                    onClick={() => appendNumber("1")}
                    disabled={disabled}
                />

                <Key
                    label="2"
                    onClick={() => appendNumber("2")}
                    disabled={disabled}
                />

                <Key
                    label="3"
                    onClick={() => appendNumber("3")}
                    disabled={disabled}
                />

                <div />

                {/* Row 4 */}
                <Key
                    label="÷"
                    onClick={() => appendOperator("/")}
                    disabled={disabled}
                />
                {/* 
                <Key
                    label="+/−"
                    onClick={handleToggleSign}
                    disabled={disabled}
                /> */}

                <Key
                    label="."
                    onClick={() => appendNumber(".")}
                    disabled={disabled}
                />

                <Key
                    label="0"
                    onClick={() => appendNumber("0")}
                    disabled={disabled}
                />



                <Key
                    label={confirmLabel}
                    onClick={handleConfirm}
                    disabled={
                        disabled ||
                        result === null
                    }
                    confirm
                />
            </div>
        </div>
    );
}

type KeyProps = {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    confirm?: boolean;
};

function Key({
    label,
    onClick,
    disabled = false,
    confirm = false,
}: KeyProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={[
                "h-[62px] items-center justify-center",
                "text-[27px] font-light",
                "transition active:scale-95",
                "select-none",
                disabled
                    ? "cursor-not-allowed text-white/20"
                    : confirm
                        ? "text-white hover:bg-white/[0.04]"
                        : "text-white/90 hover:bg-white/[0.04]",
            ].join(" ")}
        >
            {label}
        </button>
    );
}

export { calculateExpression };