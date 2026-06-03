import Link from "next/link";
import { auth, signOut } from "@/lib/auth/config";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← home
            </Link>
            <div className="h-5 w-px bg-border" aria-hidden="true" />
            <Link href="/admin" className="font-semibold tracking-tight">
              CaseForge · admin
            </Link>
            {session ? (
              <nav className="hidden gap-4 text-sm text-muted-foreground md:flex">
                <Link href="/admin/cases" className="transition-colors hover:text-foreground">
                  Cases
                </Link>
                <Link
                  href="/admin/analytics"
                  className="transition-colors hover:text-foreground"
                >
                  Analytics
                </Link>
              </nav>
            ) : null}
          </div>
          {session?.user ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Signed in as{" "}
                <span className="font-medium text-foreground">{session.user.email}</span>
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/admin/login" });
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
