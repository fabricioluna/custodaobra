import { layoutCopy } from "./copy";

/**
 * Esqueleto mostrado na hora em que a pessoa toca num link, enquanto o
 * servidor monta a tela (loading.tsx). Com ele, o toque responde na hora em
 * vez de a tela antiga ficar parada. `title`: com o título da página (telas
 * da conta); sem ele, só o conteúdo (abas da obra, que já têm cabeçalho).
 */
export function PageSkeleton({ title = false }: { title?: boolean }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="animate-pulse motion-reduce:animate-none"
    >
      <span className="sr-only">{layoutCopy.loading}</span>
      {title ? (
        <div aria-hidden className="mb-6">
          <div className="h-8 w-48 rounded-lg bg-muted" />
          <div className="mt-3 h-5 w-72 max-w-full rounded-lg bg-muted" />
        </div>
      ) : null}
      <div aria-hidden className="flex flex-col gap-4">
        <div className="h-28 rounded-2xl bg-muted" />
        <div className="h-44 rounded-2xl bg-muted" />
        <div className="h-44 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
