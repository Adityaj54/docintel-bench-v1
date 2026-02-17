import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { FileScan, ArrowRight, Check } from "lucide-react";
import { post } from "../../api/client";
import { ErrorPanel, Field } from "../../components/Feedback";
import { useMutation } from "../../hooks/useMutation";
import type { Session } from "../../types/domain";
import { useAuth } from "./AuthContext";

export function AuthPage({ register = false }: { register?: boolean }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const mutation = useMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  if (auth.user) return <Navigate to="/projects" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    const session = await mutation.execute(() => post<Session>(
      register ? "/auth/register" : "/auth/login",
      register ? { email, password, display_name: displayName } : { email, password },
    ));
    if (session) {
      auth.accept(session);
      navigate("/projects", { replace: true });
    }
  }
  return <main className="auth-layout">
    <section className="auth-story">
      <Link className="brand" to="/"><FileScan size={30} /><span>DocIntel <b>Bench</b></span></Link>
      <div>
        <p className="eyebrow">DOCUMENT INTELLIGENCE / EVALUATION</p>
        <h1>Know what your<br />documents are<br /><em>telling you.</em></h1>
        <p className="auth-description">A focused workspace to test extraction, inspect every field,
          and choose the configuration you can trust.</p>
        <ul className="auth-benefits">
          <li><Check size={18} />Version your schemas and trusted annotations</li>
          <li><Check size={18} />Compare accuracy, latency, and cost</li>
          <li><Check size={18} />Start locally with a deterministic mock provider</li>
        </ul>
      </div>
      <span className="auth-footer">Your documents. Your evaluation workspace.</span>
    </section>
    <section className="auth-form-area">
      <form className="auth-form" onSubmit={submit}>
        <span className="small-mark"><FileScan size={26} /></span>
        <h2>{register ? "Create your workspace" : "Welcome back"}</h2>
        <p className="subtitle">{register
          ? "Your account includes a sample invoice experiment to explore."
          : "Sign in to continue your experiments."}</p>
        <ErrorPanel error={mutation.error} />
        {register && <Field label="Your name">
          <input autoComplete="name" required maxLength={100} value={displayName}
            onChange={event => setDisplayName(event.target.value)} />
        </Field>}
        <Field label="Email address">
          <input type="email" autoComplete="email" required value={email}
            onChange={event => setEmail(event.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" hint={register ? "At least 12 characters." : undefined}>
          <input type="password" autoComplete={register ? "new-password" : "current-password"}
            required minLength={register ? 12 : 1} maxLength={128} value={password}
            onChange={event => setPassword(event.target.value)} />
        </Field>
        <button className="button primary full" disabled={mutation.pending}>
          {mutation.pending ? "Please wait…" : register ? "Create account" : "Sign in"}<ArrowRight size={17} />
        </button>
        <p className="auth-switch">
          {register ? "Already have an account? " : "New to DocIntel Bench? "}
          <Link to={register ? "/login" : "/register"}>{register ? "Sign in" : "Create an account"}</Link>
        </p>
      </form>
    </section>
  </main>;
}
