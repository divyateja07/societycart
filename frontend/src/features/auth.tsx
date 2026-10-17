import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { api, type Row } from "../api";
import { qc, useData } from "../app/state";
import { Feedback } from "../components/common";
const authSchema = z.object({
  email: z.email(),
  password: z.string().min(10).max(72),
  name: z.string().optional(),
  confirm: z.string().optional(),
});
export function Protected({
  children,
  admin = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  const me = useData<Row>("/auth/me");
  if (me.isPending) return <p>Checking your session…</p>;
  if (!me.data) return <Navigate to="/login" replace />;
  if (admin && me.data.role !== "ADMIN")
    return <div role="alert">Administrator access required.</div>;
  return <>{children}</>;
}
export function Auth({ register = false }: { register?: boolean }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const form = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
  });
  return (
    <section className="auth card">
      <div className="eyebrow">WELCOME TO THE COLLECTIVE</div>
      <h1>{register ? "Make yourself at home." : "Good to see you again."}</h1>
      <p>
        {register
          ? "A smarter grocery basket starts here."
          : "Sign in to your neighbourhood pantry."}
      </p>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError("");
          try {
            if (register) {
              if (!values.name?.trim() || values.confirm !== values.password)
                throw new Error("Enter your name and matching passwords");
              await api("/auth/register", "POST", values);
            }
            await api("/auth/login", "POST", values);
            await qc.invalidateQueries();
            navigate("/societies");
          } catch (e) {
            setError((e as Error).message);
          }
        })}
      >
        {register && (
          <label>
            Your name
            <input {...form.register("name")} autoComplete="name" required />
          </label>
        )}
        <label>
          Email address
          <input
            {...form.register("email")}
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            {...form.register("password")}
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
          />
          <small>10–72 characters</small>
        </label>
        {register && (
          <label>
            Confirm password
            <input
              {...form.register("confirm")}
              type="password"
              autoComplete="new-password"
              required
            />
          </label>
        )}
        <Feedback
          error={
            error ||
            Object.values(form.formState.errors)
              .map((e) => e.message)
              .join(", ")
          }
        />
        <button disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? "Please wait…"
            : register
              ? "Create account"
              : "Sign in"}{" "}
          <ArrowRight size={17} />
        </button>
      </form>
      <p>
        {register ? "Already a neighbour?" : "New to SocietyCart?"}{" "}
        <Link to={register ? "/login" : "/register"}>
          {register ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </section>
  );
}
