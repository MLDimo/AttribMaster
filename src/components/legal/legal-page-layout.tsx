import Image from "next/image";
import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgu", label: "CGU" },
  { href: "/cgv", label: "CGV" },
];

export function LegalPageLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between p-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo-icon.png" alt="" width={28} height={28} className="drop-shadow-sm" />
          <span className="font-semibold">AttribMaster</span>
        </Link>
        <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Retour à l&apos;accueil
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Dernière mise à jour : {updatedAt}</p>

        <div className="prose-legal mt-8 flex flex-col gap-6 text-sm leading-relaxed text-foreground [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground [&_li]:mt-1">
          {children}
        </div>

        <nav className="mt-12 flex flex-wrap gap-4 border-t pt-6 text-sm">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
