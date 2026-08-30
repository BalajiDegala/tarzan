import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { Brand } from '../components/Brand';

interface AuthPageProps {
  mode: 'login' | 'register';
}

export function AuthPage({ mode }: AuthPageProps) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isRegister) {
        await register({ email, name, password });
      } else {
        await login({ email, password });
      }

      navigate('/', { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07130f] text-stone-100">
      <div className="glow glow-one" />
      <div className="glow glow-two" />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between border-r border-white/10 p-10 lg:flex xl:p-14">
          <Brand />

          <div className="max-w-xl pb-8">
            <p className="mb-5 flex items-center gap-3 text-sm font-semibold text-lime-200">
              <span className="h-px w-9 bg-lime-300" />
              Team work, without the thicket.
            </p>
            <h1 className="text-6xl leading-[0.98] font-black tracking-[-0.055em] text-balance xl:text-7xl">
              Find the work.
              <br />
              <span className="text-lime-300">Move it forward.</span>
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-stone-300">
              One calm place for your team to understand what matters, who owns
              it, and what happens next.
            </p>
          </div>

          <p className="text-xs font-semibold tracking-[0.16em] text-stone-500 uppercase">
            Tarzan · Secure workspace access
          </p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-12 lg:hidden">
              <Brand />
            </div>

            <div className="mb-8">
              <span className="inline-flex rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-xs font-bold tracking-[0.14em] text-lime-200 uppercase">
                {isRegister ? 'Create an account' : 'Welcome back'}
              </span>
              <h2 className="mt-5 text-4xl font-black tracking-[-0.04em]">
                {isRegister ? 'Start with Tarzan.' : 'Sign in to your work.'}
              </h2>
              <p className="mt-3 leading-7 text-stone-400">
                {isRegister
                  ? 'Create your secure account. Team setup comes next.'
                  : 'Use the account details you registered with.'}
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {isRegister ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-stone-300">
                    Full name
                  </span>
                  <input
                    autoComplete="name"
                    className="auth-input"
                    maxLength={100}
                    minLength={2}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Balaji Ravi"
                    required
                    type="text"
                    value={name}
                  />
                </label>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-stone-300">
                  Email address
                </span>
                <input
                  autoComplete="email"
                  className="auth-input"
                  maxLength={320}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                  type="email"
                  value={email}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-stone-300">
                  Password
                </span>
                <input
                  autoComplete={
                    isRegister ? 'new-password' : 'current-password'
                  }
                  className="auth-input"
                  maxLength={72}
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                  type="password"
                  value={password}
                />
                {isRegister ? (
                  <span className="mt-2 block text-xs leading-5 text-stone-500">
                    Use uppercase, lowercase, and at least one number.
                  </span>
                ) : null}
              </label>

              {error === null ? null : (
                <div
                  className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                className="flex w-full items-center justify-center rounded-xl bg-lime-300 px-5 py-3.5 text-sm font-black text-[#07130f] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-300"
                disabled={submitting}
                type="submit"
              >
                {submitting
                  ? 'Please wait…'
                  : isRegister
                    ? 'Create account'
                    : 'Sign in'}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-stone-400">
              {isRegister ? 'Already have an account?' : 'New to Tarzan?'}{' '}
              <Link
                className="font-bold text-lime-300 hover:text-lime-200"
                to={isRegister ? '/login' : '/register'}
              >
                {isRegister ? 'Sign in' : 'Create one'}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
