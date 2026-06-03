import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-16">
      <header className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          CIKM 2026 Demo Track
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          CaseForge
        </h1>
        <p className="mt-4 text-lg text-muted-foreground md:text-xl">
          A faculty-in-the-loop authoring tool that drafts personalised professional case
          studies in minutes. Instructors set the learning objective, the LLM produces a
          discipline-grounded draft, and section-level regeneration plus discipline-tailored
          phase orchestration keep the instructor in control.
        </p>
      </header>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        <Card
          href="/admin/login"
          title="Instructor sign-in"
          subtitle="Author cases, manage phases, spawn personalised student variants."
          accent="primary"
          badge="Recommended"
        />
        <Card
          href="#student-info"
          title="Student access"
          subtitle="Students enter via a unique URL provided by their instructor — no login."
        />
        <Card
          href="/admin/analytics"
          title="Analytics dashboard"
          subtitle="Authoring time, regeneration counts, phase progression, student engagement."
        />
      </section>

      <section className="mt-12 rounded-xl border bg-muted/30 p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          The four-stage pipeline
        </h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Component
            step="1"
            name="Input"
            desc="Discipline, learning objective, must-cover concepts, target learner profile."
          />
          <Component
            step="2"
            name="Retrieval"
            desc="Dense retrieval over a curated discipline corpus (text-embedding-3-small, cosine top-k) plus discipline exemplars."
          />
          <Component
            step="3"
            name="Generation"
            desc="Streamed structured draft: scenario, discussion questions, model answers, rubric."
          />
          <Component
            step="4"
            name="Faculty editing"
            desc="Inline edits, section-level regeneration, discipline-tailored phase sequences."
          />
        </div>
      </section>

      <section
        id="student-info"
        className="mt-8 rounded-xl border border-dashed bg-background p-6 text-sm text-muted-foreground"
      >
        <strong className="text-foreground">Are you a student?</strong> Open the unique
        case URL your instructor shared with you. The page advances through phases (e.g.
        framing → analysis → recommendation, tailored per discipline) as the instructor
        progresses the cohort.
      </section>

      <footer className="mt-auto pt-12 text-sm text-muted-foreground">
        <p>Companion to the CIKM 2026 Demo Track paper.</p>
      </footer>
    </main>
  );
}

function Card({
  href,
  title,
  subtitle,
  accent,
  badge,
}: {
  href: string;
  title: string;
  subtitle: string;
  accent?: "primary";
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={
        accent === "primary"
          ? "group rounded-xl border-2 border-primary bg-primary/5 p-6 transition-all hover:bg-primary/10 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          : "group rounded-xl border p-6 transition-all hover:border-foreground/20 hover:bg-muted/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">{title}</h2>
        {badge ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
            {badge}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground transition-transform group-hover:translate-x-0.5">
            →
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
    </Link>
  );
}

function Component({ step, name, desc }: { step: string; name: string; desc: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-mono text-muted-foreground">0{step}</span>
        <h3 className="text-sm font-medium">{name}</h3>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}
