import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
} from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { auth, firebaseConfigured } from "./firebase";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!active) return;
      setUser(u);
      setLoading(false);
    });

    // Complete a Google redirect sign-in after Firebase sends the user back.
    getRedirectResult(auth)
      .then(() => {
        // onAuthStateChanged is the source of truth for the signed-in user.
      })
      .catch((e: any) => {
        if (!active) return;
        setError(
          e?.code === "auth/unauthorized-domain"
            ? "This PAL domain is not authorized in Firebase Authentication."
            : e?.message ?? "Google sign-in failed."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (!firebaseConfigured) return <SetupScreen />;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020708] text-white flex items-center justify-center">
        <div className="text-xs text-zinc-500 animate-pulse">
          Starting PAL secure session…
        </div>
      </div>
    );
  }

  if (user) return <>{children}</>;

  const google = async () => {
    if (!auth) return;

    setBusy(true);
    setError("");

    try {
      // Redirect avoids browser Cross-Origin-Opener-Policy problems that can
      // break Firebase signInWithPopup on deployed Vercel domains.
      await signInWithRedirect(auth, new GoogleAuthProvider());
    } catch (e: any) {
      setBusy(false);
      setError(
        e?.code === "auth/unauthorized-domain"
          ? "This PAL domain is not authorized in Firebase Authentication."
          : e?.message ?? "Google sign-in failed."
      );
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    setBusy(true);
    setError("");

    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (e: any) {
      setError(
        e?.code === "auth/invalid-credential"
          ? "Email or password is incorrect."
          : e?.code === "auth/email-already-in-use"
            ? "An account already exists for this email."
            : e?.message ?? "Authentication failed."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020708] text-white flex items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none fixed -left-40 top-0 h-96 w-96 rounded-full bg-cyan-400/[.06] blur-[120px]" />
      <div className="pointer-events-none fixed -right-40 bottom-0 h-96 w-96 rounded-full bg-emerald-400/[.05] blur-[120px]" />

      <main className="relative w-full max-w-[430px]">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/[.06] text-2xl text-cyan-300 shadow-[0_0_35px_rgba(32,217,255,.12)]">
            ⌁
          </div>

          <h1 className="mt-5 text-2xl font-semibold">Welcome to PAL</h1>
          <p className="mt-2 text-xs leading-5 text-zinc-600">
            Your private AI trading intelligence workspace.
          </p>
        </div>

        <section className="rounded-3xl border border-white/[.08] bg-[#08100f]/95 p-6 shadow-[0_35px_100px_rgba(0,0,0,.55)]">
          <div className="flex rounded-xl border border-white/[.06] bg-black/20 p-1 mb-5">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-lg py-2 text-[10px] font-semibold ${mode === "signin" ? "bg-white/[.07] text-white" : "text-zinc-600"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-lg py-2 text-[10px] font-semibold ${mode === "signup" ? "bg-white/[.07] text-white" : "text-zinc-600"}`}
            >
              Create account
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={google}
            className="w-full rounded-xl border border-white/[.09] bg-white/[.04] px-4 py-3 text-xs font-semibold text-white hover:bg-white/[.07] disabled:opacity-50"
          >
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-[8px] uppercase tracking-[.2em] text-zinc-700">
            <span className="h-px flex-1 bg-white/[.06]" />
            or use PAL account
            <span className="h-px flex-1 bg-white/[.06]" />
          </div>

          <form onSubmit={submit}>
            <label className="text-[9px] uppercase tracking-widest text-zinc-600">
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-white/[.08] bg-black/30 px-3 py-3 text-xs text-white outline-none focus:border-cyan-300/30"
                placeholder="you@example.com"
              />
            </label>

            <label className="mt-3 block text-[9px] uppercase tracking-widest text-zinc-600">
              Password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="mt-2 w-full rounded-xl border border-white/[.08] bg-black/30 px-3 py-3 text-xs text-white outline-none focus:border-cyan-300/30"
                placeholder="Your PAL password"
              />
            </label>

            {error && (
              <div className="mt-3 rounded-xl border border-red-300/10 bg-red-300/[.04] p-3 text-[10px] leading-4 text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-cyan-300 px-4 py-3 text-xs font-bold text-[#031014] disabled:opacity-50"
            >
              {busy
                ? "Authenticating…"
                : mode === "signin"
                  ? "Sign in to PAL"
                  : "Create PAL account"}
            </button>
          </form>

          <p className="mt-4 text-center text-[8px] leading-4 text-zinc-700">
            Google authentication never asks PAL to know your Google password.
            Email/password accounts use Firebase Authentication.
          </p>
        </section>

        <div className="mt-4 text-center text-[8px] uppercase tracking-widest text-zinc-800">
          Private workspace · Secure authentication
        </div>
      </main>
    </div>
  );
}

function SetupScreen() {
  return (
    <div className="min-h-screen bg-[#020708] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-3xl border border-amber-300/10 bg-[#08100f] p-7 shadow-2xl">
        <div className="text-[9px] uppercase tracking-[.25em] text-amber-300/70">
          PAL setup required
        </div>
        <h1 className="mt-2 text-2xl font-semibold">
          Connect authentication before launch
        </h1>
        <p className="mt-3 text-xs leading-6 text-zinc-500">
          PAL is intentionally locked until Firebase Authentication is configured.
          Add the VITE_FIREBASE_* values to frontend/.env.local, enable Google and
          Email/Password providers, then restart Vite.
        </p>
        <div className="mt-5 rounded-2xl border border-white/[.06] bg-black/20 p-4 font-mono text-[9px] leading-5 text-zinc-500">
          VITE_FIREBASE_API_KEY=…
          <br />
          VITE_FIREBASE_AUTH_DOMAIN=…
          <br />
          VITE_FIREBASE_PROJECT_ID=…
          <br />
          VITE_FIREBASE_STORAGE_BUCKET=…
          <br />
          VITE_FIREBASE_MESSAGING_SENDER_ID=…
          <br />
          VITE_FIREBASE_APP_ID=…
        </div>
      </div>
    </div>
  );
}
