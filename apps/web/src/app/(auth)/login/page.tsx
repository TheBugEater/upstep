"use client";

import { signIn } from "next-auth/react";
import { Logo, LogoMark } from "@/components/Logo";
import { BoardPreview } from "@/components/marketing/BoardPreview";
import Link from "next/link";
import { useOnRamp } from "@onramp-sdk/react";

export default function LoginPage() {
  const { step } = useOnRamp();
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col px-6 py-8 bg-canvas">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/" className="text-sm text-muted hover:text-ink transition">
            ← Back home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <h1 className="font-serif text-3xl tracking-tight text-ink">Welcome back</h1>
            <p className="mt-2 text-sm text-muted">
              Sign in to manage feedback for your projects.
            </p>

            <div className="mt-8 space-y-3">
              <button
                onClick={() => { step("oauth_clicked", { properties: { provider: "github" } }); signIn("github", { callbackUrl: "/dashboard" }); }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-ink text-white rounded-xl text-sm font-medium hover:bg-ink-soft transition shadow-sm"
              >
                <GitHubIcon />
                Continue with GitHub
              </button>

              <button
                onClick={() => { step("oauth_clicked", { properties: { provider: "google" } }); signIn("google", { callbackUrl: "/dashboard" }); }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-card border border-line text-ink rounded-xl text-sm font-medium hover:bg-surface transition"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <div className="flex-1 h-px bg-line" />
              <span className="text-xs text-faint">secured by OAuth</span>
              <div className="flex-1 h-px bg-line" />
            </div>

            <p className="mt-8 text-xs text-faint leading-relaxed">
              By continuing you agree to our{" "}
              <a href="/legal/terms" className="underline hover:text-muted transition">Terms of Service</a>
              {" "}and{" "}
              <a href="/legal/privacy" className="underline hover:text-muted transition">Privacy Policy</a>.
              {" "}We&apos;ll never post anything without your permission.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-faint">© {new Date().getFullYear()} Upstep</p>
      </div>

      {/* Right — brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink p-12">
        <div className="absolute inset-0 bg-grid opacity-[0.07]" />
        <div className="absolute inset-0 bg-glow opacity-60" />

        <div className="relative flex items-center gap-2.5 text-white">
          <LogoMark size={28} />
          <span className="font-semibold tracking-tight">Upstep</span>
        </div>

        <div className="relative">
          <h2 className="font-serif text-3xl leading-snug text-white/95 max-w-md">
            Collect feedback, let users vote, and ship what matters.
          </h2>
          <p className="mt-4 text-sm text-white/55 max-w-sm leading-relaxed">
            Your feedback board, sorted by what your users care about most.
          </p>

          <div className="mt-8 max-w-md">
            <BoardPreview />
          </div>
        </div>

        <ul className="relative flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/55">
          <li className="flex items-center gap-1.5"><span className="text-clay">✓</span> 2-line integration</li>
          <li className="flex items-center gap-1.5"><span className="text-clay">✓</span> Web &amp; React Native</li>
          <li className="flex items-center gap-1.5"><span className="text-clay">✓</span> No infrastructure</li>
        </ul>
      </div>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
