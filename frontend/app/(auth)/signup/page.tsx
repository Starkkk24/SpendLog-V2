"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signup } from "@/services/auth";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";

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

            alert("Account created successfully!");

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
        <div className="min-h-screen flex items-center justify-center bg-gray-800">

            <form
                onSubmit={handleSubmit}
                className="w-full max-w-sm bg-gray-700 p-8 rounded-xl shadow-lg space-y-5"
            >
                <h1 className="text-3xl font-bold text-center">
                    Sign Up
                </h1>

                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full border rounded-lg p-3"
                    required
                />
                {errors.username && (
                    <p className="text-red-400 text-sm">
                        {errors.username}
                    </p>
                )}

                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border rounded-lg p-3 pr-12"
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        className="absolute inset-y-0 right-3 flex items-center text-sp-muted transition hover:text-white"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>

                <div className="relative">
                    <input
                        type={showPassword2 ? "text" : "password"}
                        placeholder="Confirm Password"
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
                        className="w-full border rounded-lg p-3 pr-12"
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword2((visible) => !visible)}
                        className="absolute inset-y-0 right-3 flex items-center text-sp-muted transition hover:text-white"
                        aria-label={showPassword2 ? "Hide password" : "Show password"}
                    >
                        {showPassword2 ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>
                {errors.password && (
                    <p className="text-red-400 text-sm">
                        {errors.password}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                    {loading ? "Creating account..." : "Sign Up"}
                </button>

                <p className="text-center text-sm text-gray-300">
                    Already have an account?{" "}
                    <Link
                        href="/login"
                        className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
                    >
                        Log in
                    </Link>
                </p>

            </form>

        </div>
    );
}
