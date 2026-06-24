import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="text-sm text-muted mt-4 max-w-xs leading-relaxed">
              Feedback that moves you forward. Collect, vote, and ship what
              your users actually want.
            </p>
          </div>

          <FooterCol
            title="Product"
            links={[
              ["Features", "/#features"],
              ["How it works", "/#how"],
              ["Pricing", "/pricing"],
              ["Developers", "/#integrate"],
            ]}
          />
          <FooterCol
            title="Resources"
            links={[
              ["Documentation", "#integrate"],
              ["@upstep/js on npm", "https://www.npmjs.com/package/@upstep/js"],
              ["@upstep/react-native on npm", "https://www.npmjs.com/package/@upstep/react-native"],
            ]}
          />
          <FooterCol
            title="Account"
            links={[
              ["Sign in", "/login"],
              ["Get started", "/login"],
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              ["Terms of Service", "/legal/terms"],
              ["Privacy Policy", "/legal/privacy"],
            ]}
          />
        </div>

        <div className="mt-12 pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-faint">
          <p>© {new Date().getFullYear()} Upstep. All rights reserved.</p>
          <p>Built for builders.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-faint mb-4">{title}</h4>
      <ul className="space-y-2.5">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-sm text-muted hover:text-ink transition">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
