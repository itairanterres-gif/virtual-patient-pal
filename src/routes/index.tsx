import { createFileRoute, Link } from "@tanstack/react-router";
import { CASES } from "@/lib/cases";
import { patientAvatars } from "@/lib/avatars";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vitalis·Sim — Simulação clínica com paciente virtual" },
      {
        name: "description",
        content:
          "Treine anamnese, raciocínio clínico e conduta com pacientes virtuais de IA em português, com sinais vitais em tempo real e avaliação por domínios.",
      },
      { property: "og:title", content: "Vitalis·Sim — Simulação clínica com paciente virtual" },
      {
        property: "og:description",
        content:
          "Casos clínicos interativos com paciente de IA, sinais vitais, exames e feedback estruturado em cinco domínios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Biblioteca,
});

function Biblioteca() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[390px] flex-col bg-background font-sans text-foreground">
      <header className="sticky top-0 z-20 shrink-0 border-b border-line bg-background/95 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-sm bg-raise font-mono text-[11px] font-semibold text-normal ring-1 ring-normal/30">
            V
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">
              Vitalis<span className="text-faint">·</span>Sim
            </p>
            <p className="font-mono text-[10px] tracking-wide text-faint">COCKPIT CLÍNICO</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-8">
        <h1 className="text-[15px] font-semibold">Biblioteca de casos</h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          {CASES.length + 1} casos · paciente virtual
        </p>

        <div className="mt-4 space-y-2.5">
          <Link
            to="/caso/$id"
            params={{ id: "PV-001" }}
            className="block rounded-md bg-card p-3 ring-1 ring-line hover:ring-primary/50"
          >
            <p className="text-[13px] font-semibold">
              Maria Aparecida Souza, 61 anos — consulta de retorno
            </p>
            <p className="mt-1 text-[12px] text-faint">
              Ambulatório do SUS · 12ª fase · 15 minutos · complexidade baixa
            </p>
            <p className="mt-1 text-[11px] text-faint">PV-001 v1.1 · pré-piloto formativo</p>
          </Link>
          {CASES.map((c) => (
            <Link
              key={c.id}
              to="/caso/$id"
              params={{ id: c.id }}
              className="block rounded-md bg-card p-3 ring-1 ring-line transition-colors hover:ring-primary/50"
            >
              <div className="flex items-center gap-3">
                <img
                  src={patientAvatars[c.id]}
                  alt={`Retrato do paciente virtual ${c.patientName}`}
                  loading="lazy"
                  className="size-11 shrink-0 rounded-md object-cover ring-1 ring-line"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">
                    {c.patientName}, {c.age}a — “{c.chiefComplaint}”
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-faint">
                    {c.specialty} · {c.environment} · Dificuldade {c.difficulty}/5
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[12px] leading-snug text-pretty text-faint">{c.summary}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
