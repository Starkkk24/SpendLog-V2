'use client';

import { useRouter } from "next/navigation";


export default function Home() {
  const router = useRouter();
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <>
          <div className="flex flex-row items-center justify-center w-full gap-4">
          <div className="flex flex-row items-center justify-center w-full gap-4">
            <button onClick = {() => {router.push("/login")}}  className="inline-flex rounded-xl bg-blue-600  hover:bg-blue-500">
              <span className="flex items-center justify-center rounded-[10px] bg-neutral-primary-soft px-5 py-2.5 text-sm font-medium text-heading transition-all duration-300 group-hover:bg-transparent group-hover:text-white">
                Login
              </span>
            </button>
            <button onClick = {() => {router.push("/signup")}} className="inline-flex rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500">
              <span className="flex items-center justify-center rounded-[10px] bg-neutral-primary-soft px-5 py-2.5 text-sm font-medium text-heading transition-all duration-300 group-hover:bg-transparent group-hover:text-white">
                Signup
              </span>
            </button>

          </div>

          </div>
        </>
      </main>
    </div>
  );
}
