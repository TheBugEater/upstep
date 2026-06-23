import type { Metadata } from "next";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "Terms of Service — Upstep",
  description: "The terms governing your use of Upstep.",
};

const EFFECTIVE = "June 23, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        <p className="text-xs text-clay font-semibold uppercase tracking-widest mb-4">Legal</p>
        <h1 className="font-serif text-4xl tracking-tight text-ink mb-2">Terms of Service</h1>
        <p className="text-sm text-muted mb-12">Effective {EFFECTIVE}</p>

        <div className="prose-upstep">
          <Section title="1. Acceptance">
            <p>
              By creating an account or using Upstep (&ldquo;the Service&rdquo;), you agree to
              these Terms of Service (&ldquo;Terms&rdquo;). If you don&rsquo;t agree, please
              don&rsquo;t use the Service.
            </p>
          </Section>

          <Section title="2. Account &amp; access">
            <p>
              You sign in via GitHub or Google OAuth. You are responsible for keeping your
              account secure and for all activity that occurs under it. You must not share
              your API keys publicly or allow unauthorized access to your projects.
            </p>
          </Section>

          <Section title="3. Acceptable use">
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service to collect feedback on behalf of people who haven&rsquo;t consented.</li>
              <li>Submit abusive, illegal, or misleading content.</li>
              <li>Attempt to reverse-engineer, scrape, or abuse the API beyond its intended use.</li>
              <li>Resell or sublicense access to the Service without our written permission.</li>
            </ul>
          </Section>

          <Section title="4. Plans, payment &amp; billing">
            <p>
              The Free plan is available to all users at no cost. Paid plans (Pro, Business) are billed
              monthly through Stripe. You can cancel at any time from the Billing page; your plan
              remains active until the end of the current billing period, after which it reverts to
              Free. We reserve the right to change pricing with 30 days&rsquo; notice.
            </p>
          </Section>

          <Section title="5. Your data">
            <p>
              You retain ownership of all feedback data collected through your projects. We process
              it only to provide the Service. You can delete your projects and data from the dashboard
              at any time.
            </p>
          </Section>

          <Section title="6. Service availability">
            <p>
              We aim for high availability but make no guarantees of uptime or uninterrupted access.
              We may perform maintenance, update the Service, or suspend access to fix issues without
              prior notice.
            </p>
          </Section>

          <Section title="7. Intellectual property">
            <p>
              The Upstep platform, branding, and SDKs are our intellectual property. Your content and
              data remain yours. Nothing in these Terms transfers ownership of either party&rsquo;s IP.
            </p>
          </Section>

          <Section title="8. Termination">
            <p>
              You may stop using the Service at any time. We may suspend or terminate your account
              if you violate these Terms, with or without notice. Upon termination, your data will
              be retained for 30 days and then permanently deleted.
            </p>
          </Section>

          <Section title="9. Limitation of liability">
            <p>
              The Service is provided &ldquo;as is&rdquo; without warranty of any kind. To the
              fullest extent permitted by law, we are not liable for indirect, incidental, or
              consequential damages arising from your use of the Service.
            </p>
          </Section>

          <Section title="10. Changes to these Terms">
            <p>
              We may update these Terms from time to time. We&rsquo;ll notify you of material changes
              by email or by posting a notice in the dashboard. Continued use after changes constitutes
              acceptance.
            </p>
          </Section>

          <Section title="11. Contact" last>
            <p>
              Questions about these Terms? Email us at{" "}
              <a href="mailto:hello@upstep.io" className="text-clay hover:underline">
                hello@upstep.io
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
      <div className="text-sm text-ink-soft leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        {children}
      </div>
    </div>
  );
}
