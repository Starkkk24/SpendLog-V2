"use client";

import { toast } from "@/components/ui/Toast";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/services/auth";
import AuthShell from "@/components/auth/AuthShell";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const router = useRouter();

    async function handleSubmit(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setLoading(true);

        try {
            await login(username.trim(), password);

            router.push("/transactions");
        } catch (error) {
            console.error(error);
            toast.error("Invalid username or password");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthShell
            title="Welcome back"
            subtitle="Log in to keep your spends in check."
            footer={
                <>
                    Don&apos;t have an account?{" "}
                    <Link href="/signup" className="font-semibold text-sp-primary hover:underline">
                        Sign up
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Username">
                    {(id) => (
                        <Input
                            id={id}
                            type="text"
                            placeholder="Username"
                            autoComplete="username"
                            autoCapitalize="none"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    )}
                </Field>

                <Field label="Password">
                    {(id) => (
                        <PasswordInput
                            id={id}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            autoComplete="current-password"
                            visible={showPassword}
                            onToggle={() => setShowPassword((visible) => !visible)}
                        />
                    )}
                </Field>

                <Button type="submit" size="lg" block loading={loading} className="mt-2">
                    Login
                </Button>
            </form>
        </AuthShell>
    );
}
