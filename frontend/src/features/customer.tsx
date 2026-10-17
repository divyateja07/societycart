import { ArrowRight, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type Row } from "../api";
import { qc, useData } from "../app/state";
import { Feedback, Load, PageTitle } from "../components/common";
export function Societies() {
  const [search, setSearch] = useState("");
  const societies = useData<Row[]>(
    "/societies?search=" + encodeURIComponent(search),
  );
  const memberships = useData("/memberships/me");
  const [flat, setFlat] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <PageTitle
        eyebrow="YOUR COMMUNITY"
        title="Find your people."
        text="Request membership. Once approved, your society’s collective is open to you."
      />
      <label className="search">
        <Search size={20} />
        <input
          aria-label="Search societies"
          placeholder="Search your society…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <label className="flat">
        Your flat number
        <input
          value={flat}
          onChange={(e) => setFlat(e.target.value)}
          placeholder="e.g. A-204"
          maxLength={30}
        />
      </label>
      <Feedback error={error} />
      <Load query={societies} />
      <div className="grid">
        {societies.data?.map((s) => {
          const membership = memberships.data?.find(
            (m) => m.society_id === s.id,
          );
          return (
            <article className="card" key={s.id}>
              <div className="society-image">🏘️</div>
              <h2>{s.name}</h2>
              <p>{s.location}</p>
              {membership ? (
                <>
                  <span className={"badge " + membership.status.toLowerCase()}>
                    {membership.status}
                  </span>
                  {membership.status === "APPROVED" && (
                    <Link className="button" to="/shop">
                      Shop your collective <ArrowRight size={17} />
                    </Link>
                  )}
                </>
              ) : (
                <button
                  disabled={!flat.trim()}
                  onClick={async () => {
                    try {
                      await api("/memberships", "POST", {
                        societyId: s.id,
                        flat,
                      });
                      await qc.invalidateQueries({
                        queryKey: ["/memberships/me"],
                      });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Request to join
                </button>
              )}
            </article>
          );
        })}
      </div>
      {societies.data?.length === 0 && (
        <div className="empty">No societies found.</div>
      )}
    </>
  );
}
export function Profile() {
  const [error, setError] = useState("");
  const me = useData<Row>("/auth/me");
  const memberships = useData("/memberships/me");
  return (
    <>
      <PageTitle eyebrow="YOUR ACCOUNT" title={me.data?.name || "My profile"} />
      <section className="card">
        <p>{me.data?.email}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("/profile", "PATCH", {
                name: new FormData(e.currentTarget).get("name"),
              });
              await qc.invalidateQueries();
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            Display name
            <input
              name="name"
              defaultValue={me.data?.name}
              required
              maxLength={100}
            />
          </label>
          <button>Save profile</button>
          <Feedback error={error} />
        </form>
        <p>Account role: {me.data?.role}</p>
        {memberships.data?.map((m) => (
          <p key={m.id}>
            {m.society_name} · {m.flat} · {m.status}
          </p>
        ))}
        <Link to="/societies">Manage society memberships →</Link>
      </section>
    </>
  );
}
