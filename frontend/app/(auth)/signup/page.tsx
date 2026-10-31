"use client";

import { toast } from "@/components/ui/Toast";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signup } from "@/services/auth";
import axios from "axios";
import AuthShell from "@/components/auth/AuthShell";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";

export default function SignupPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showPassword2, setShowPassword2] = useState(false);
    const [errors, setErrors] = useState<{
        username?: string;
        password?: string;
    }>({});

    const router = useRouter();

    async function handleSubmit(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setLoading(true);
        setErrors({});

        try {
            await signup(username.trim(), password, password2);

            toast.success("Account created successfully!");

            router.push("/login");
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const data = error.response?.data;
                setErrors({
                    username: data?.username?.[0],
                    password: data?.password?.[0],
                });
            } else {
                console.log("Unexpected error:", error);
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthShell
            title="Create account"
            subtitle="Start logging and splitting in seconds."
            footer={
                <>
                    Already have an account?{" "}
                    <Link href="/login" className="font-semibold text-sp-primary hover:underline">
                        Log in
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Username" error={errors.username}>
                    {(id) => (
                        <Input
                            id={id}
                            type="text"
                            placeholder="Username"
                            autoComplete="username"
                            autoCapitalize="none"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            invalid={!!errors.username}
                            required
                        />
                    )}
                </Field>

                <Field label="Password">
                    {(id) => (
                        <PasswordInput
                            id={id}
                            placeholder="Password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            invalid={!!errors.password}
                            visible={showPassword}
                            onToggle={() => setShowPassword((visible) => !visible)}
                            required
                        />
                    )}
                </Field>

                <Field label="Confirm password" error={errors.password}>
                    {(id) => (
                        <PasswordInput
                            id={id}
                            placeholder="Confirm Password"
                            autoComplete="new-password"
                            value={password2}
                            onChange={(e) => setPassword2(e.target.value)}
                            invalid={!!errors.password}
                            visible={showPassword2}
                            onToggle={() => setShowPassword2((visible) => !visible)}
                            required
                        />
                    )}
                </Field>

                <Button type="submit" size="lg" block loading={loading} className="mt-2">
                    Sign Up
                </Button>
            </form>
        </AuthShell>
    );
}
