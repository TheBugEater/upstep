import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr]">
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
              ["Feedback board", "/feedback-board"],
              ["How it works", "/#how"],
              ["Pricing", "/pricing"],
              ["Use cases", "/use-cases"],
              ["Blog", "/blog"],
              ["Free tools", "/tools"],
            ]}
          />
          <FooterCol
            title="Resources"
            links={[
              ["Documentation", "/#integrate"],
              ["Developer guides", "/guides"],
              ["MCP server", "/#mcp"],
              ["Why open source", "/blog/upstep-is-open-source"],
              ["Source code", "https://github.com/TheBugEater/upstep"],
              ["Integrations", "/integrations"],
              ["@upstep/js on npm", "https://www.npmjs.com/package/@upstep/js"],
              ["@upstep/react-native on npm", "https://www.npmjs.com/package/@upstep/react-native"],
              ["upstep_flutter on pub.dev", "https://pub.dev/packages/upstep_flutter"],
            ]}
          />
          <FooterCol
            title="Compare"
            links={[
              ["vs Canny", "/alternatives/canny"],
              ["vs Featurebase", "/alternatives/featurebase"],
              ["vs Frill", "/alternatives/frill"],
              ["All alternatives", "/alternatives"],
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
              ["AGPL license", "https://github.com/TheBugEater/upstep/blob/main/LICENSE"],
            ]}
          />
        </div>

        <div className="mt-12 pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-faint">
          <p>© {new Date().getFullYear()} Upstep contributors. Server source licensed AGPL-3.0.</p>
          <p>
            Built for builders. Analytics by{" "}
            <a
              href="https://getonramp.dev"
              className="hover:text-ink transition"
            >
              Onramp
            </a>
            .
          </p>
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
