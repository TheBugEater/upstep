import type { Metadata } from "next";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Upstep collects, uses, and protects your information.",
  alternates: { canonical: "/legal/privacy" },
};

const EFFECTIVE = "June 23, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        <p className="text-xs text-clay font-semibold uppercase tracking-widest mb-4">
          Legal
        </p>
        <h1 className="font-serif text-4xl tracking-tight text-ink mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted mb-12">Effective {EFFECTIVE}</p>

        <div>
          <Section title="1. What we collect">
            <p>When you sign in, we receive from GitHub or Google:</p>
            <ul>
              <li>Your email address</li>
              <li>Your display name and profile picture</li>
              <li>An OAuth account identifier</li>
            </ul>
            <p>
              When you subscribe to a paid plan, Stripe handles payment
              processing. We store your Stripe customer ID and subscription ID,
              but never your card details.
            </p>
            <p>
              We also store the projects, API keys, and feedback data you create
              or collect through the Service.
            </p>
          </Section>

          <Section title="2. How we use it">
            <p>We use the information we collect to:</p>
            <ul>
              <li>Authenticate you and maintain your session</li>
              <li>Provision and manage your projects and plan limits</li>
              <li>
                Send transactional emails (e.g. new feedback notifications) via
                Resend
              </li>
              <li>Process billing and manage your subscription via Stripe</li>
              <li>Measure usage to improve the Service</li>
            </ul>
            <p>
              We do not sell your data to third parties or use it for
              advertising.
            </p>
          </Section>

          <Section title="3. Third-party services">
            <p>We use the following third-party services to operate Upstep:</p>
            <ul>
              <li>
                <strong>GitHub / Google</strong>: OAuth authentication
              </li>
              <li>
                <strong>Stripe</strong>: payment processing and subscription
                management
              </li>
              <li>
                <strong>Resend</strong>: transactional email delivery
              </li>
              <li>
                <strong>Railway / Neon</strong>: cloud infrastructure and
                database hosting
              </li>
            </ul>
            <p>
              Each service has its own privacy policy governing how they handle
              data.
            </p>
          </Section>

          <Section title="4. Cookies &amp; sessions">
            <p>
              We use a secure, HTTP-only session cookie to keep you signed in
              (managed by Auth.js). We also set an optional{" "}
              <code className="font-mono text-xs bg-surface border border-line rounded px-1">
                upstep_currency
              </code>{" "}
              cookie to remember your preferred currency on the pricing page. No
              tracking or advertising cookies are used.
            </p>
          </Section>

          <Section title="5. Data retention">
            <p>
              Your data is retained for as long as your account is active. If
              you delete a project, its feedback data is permanently removed
              immediately. If you close your account, all data is deleted within
              30 days.
            </p>
          </Section>

          <Section title="6. Your rights">
            <p>
              You can delete your projects and their data at any time from the
              dashboard. To request full account deletion or a copy of your
              data, email us at{" "}
              <a
                href="mailto:hello@upstep.dev"
                className="text-clay hover:underline"
              >
                hello@upstep.dev
              </a>
              . We&rsquo;ll respond within 30 days.
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We use HTTPS for all data in transit. Database access is
              restricted and credentials are never stored in client-facing code.
              API keys are stored hashed where possible. No security measure is
              perfect, and we encourage you to report any vulnerabilities
              responsibly.
            </p>
          </Section>

          <Section title="8. Changes to this policy">
            <p>
              We may update this Privacy Policy occasionally. Material changes
              will be communicated by email or via a notice in the dashboard.
              The effective date at the top of this page reflects the latest
              revision.
            </p>
          </Section>

          <Section title="9. Contact" last>
            <p>
              Questions or concerns about your privacy? Reach us at{" "}
              <a
                href="mailto:hello@upstep.dev"
                className="text-clay hover:underline"
              >
                hello@upstep.dev
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`${last ? "" : "mb-10 pb-10 border-b border-line"}`}>
      <h2 className="font-serif text-xl text-ink mb-3">{title}</h2>
      <div className="text-sm text-ink-soft leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-ink [&_code]:text-[12px]">
        {children}
      </div>
    </div>
  );
}
