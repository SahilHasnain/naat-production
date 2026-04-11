"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const primaryNavItems = [
  { href: "/admin", label: "Exclude" },
  { href: "/admin/channels", label: "Channels" },
  { href: "/admin/ingest", label: "Ingest" },
  { href: "/admin/audios", label: "Audios" },
];

const secondaryNavItems = [
  { href: "/admin/database", label: "Database" },
  { href: "/admin/manual-cut", label: "Manual Cut" },
  { href: "/admin/ai-jobs", label: "AI Jobs" },
];

function isItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}

function NavPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
          : "border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

export default function AdminHeader() {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-neutral-950/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <Link href="/admin" className="text-lg font-semibold tracking-tight text-white">
              Naat Production Admin
            </Link>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-sky-300/70">
              Internal Workspace
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2 xl:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <nav className="flex flex-wrap gap-2">
              {primaryNavItems.map((item) => (
                <NavPill
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={isItemActive(pathname, item.href)}
                />
              ))}
              </nav>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              >
                Logout
              </button>
            </div>

            <nav className="flex flex-wrap gap-2">
              {secondaryNavItems.map((item) => (
                <NavPill
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={isItemActive(pathname, item.href)}
                />
              ))}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
