"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/services/auth";
import { Eye, EyeOff } from "lucide-react";

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
            await login(username, password);

            router.push("/transactions");
        } catch (error) {
            console.error(error);
            alert("Invalid username or password");
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
                    Login
                </h1>

                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full border rounded-lg p-3"
                />


                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full border rounded-lg p-3"
                    />

                    <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        className="absolute inset-y-0 right-3 flex items-center text-sp-muted transition hover:text-white"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? (
                            <EyeOff size={20} />
                        ) : (
                            <Eye size={20} />
                        )}
                    </button>
                </div>


                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                    {loading ? "Logging in..." : "Login"}
                </button>

            </form>

        </div>
    );
}