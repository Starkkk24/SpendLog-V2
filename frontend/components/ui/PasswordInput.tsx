"use client";

import { Eye, EyeOff } from "lucide-react";
import { Input } from "./Input";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
    visible: boolean;
    onToggle: () => void;
    invalid?: boolean;
};

export default function PasswordInput({ visible, onToggle, invalid, ...props }: PasswordInputProps) {
    return (
        <div className="relative">
            <Input type={visible ? "text" : "password"} invalid={invalid} className="pr-12" {...props} />
            <button
                type="button"
                onClick={onToggle}
                className="absolute inset-y-0 right-1 grid w-11 place-items-center rounded-sp-md text-sp-muted transition hover:text-sp-text active:scale-90"
                aria-label={visible ? "Hide password" : "Show password"}
            >
                {visible ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
        </div>
    );
}
