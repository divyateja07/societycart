export function Feedback({ error }: { error: unknown }) {
  return error ? (
    <div role="alert" className="error">
      {error instanceof Error ? error.message : String(error)}
    </div>
  ) : null;
}
export function Load({
  query,
}: {
  query: { isPending: boolean; error: unknown };
}) {
  return (
    <>
      {query.isPending && <p role="status">Loading…</p>}
      <Feedback error={query.error} />
    </>
  );
}
export function PageTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <section className="page-title">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {text && <p>{text}</p>}
    </section>
  );
}
