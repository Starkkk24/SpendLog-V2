"use client";

import { useState } from "react";

export default function SignUpPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    async function handleSignup() {

        const res = await fetch(
            "http://127.0.0.1:8000/signup/",
            {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            }
        );
        const data = await res.json();
        console.log(data);
        alert(res.ok ? "Signup success" : "Signup failed");
    }

    return (
        <div className="flex items-center justify-center min-h-screen">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSignup();
                }}
                className="bg-black p-8 rounded-2xl shadow-md w-80"
            >
                <h2 className="text-2xl font-semibold mb-6 text-center">Signup</h2>

                <input
                    type="text"
                    placeholder="Username"
                    className="w-full p-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <input
                    type="password"
                    placeholder="Password"
                    className="w-full p-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <button
                    type="submit"
                    className="w-full bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition"
                >
                    Signup
                </button>
            </form>
        </div>
    );

}