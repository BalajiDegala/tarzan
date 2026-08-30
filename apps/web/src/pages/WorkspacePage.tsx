import { useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { Brand } from '../components/Brand';

export function WorkspacePage() {
  const { logout, user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  if (user === null) {
    return null;
  }

  async function handleLogout() {
    setSigningOut(true);
    await logout();
  }

  const firstName = user.name.split(' ')[0] || user.name;
  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <main className="min-h-screen bg-[#f4f5ef] text-[#102018]">
      <header className="border-b border-emerald-950/10 bg-[#07130f] text-stone-100">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 lg:px-8">
          <Brand />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold">{user.name}</p>
              <p className="text-xs text-stone-400">{user.email}</p>
            </div>
            <span className="grid size-10 place-items-center rounded-full bg-lime-300 text-sm font-black text-[#07130f]">
              {initials}
            </span>
            <button
              className="ml-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-stone-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white disabled:opacity-60"
              disabled={signingOut}
              onClick={() => void handleLogout()}
              type="button"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-14 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-black tracking-[0.16em] text-emerald-700 uppercase">
            Your workspace
          </p>
          <h1 className="mt-4 text-5xl font-black tracking-[-0.05em] text-balance sm:text-6xl">
            Welcome, {firstName}.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-emerald-950/65">
            Your account is secure and your session is active. Tarzan is ready
            for the next milestone: building your team.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-[1.25fr_0.75fr]">
          <article className="rounded-[2rem] bg-[#0c251b] p-8 text-stone-100 shadow-xl shadow-emerald-950/10 sm:p-10">
            <div className="flex items-start justify-between gap-6">
              <div>
                <span className="inline-flex rounded-full bg-lime-300/10 px-3 py-1 text-xs font-black tracking-[0.14em] text-lime-300 uppercase">
                  Milestone M1
                </span>
                <h2 className="mt-5 text-3xl font-black tracking-[-0.035em]">
                  Secure access is ready.
                </h2>
                <p className="mt-3 max-w-xl leading-7 text-stone-400">
                  Registration, login, session restoration, protected routes,
                  and server-side logout are connected end to end.
                </p>
              </div>
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime-300 text-xl text-[#07130f]">
                ✓
              </span>
            </div>
          </article>

          <article className="rounded-[2rem] border border-emerald-950/10 bg-white p-8 shadow-sm">
            <p className="text-xs font-black tracking-[0.16em] text-emerald-700 uppercase">
              Account
            </p>
            <dl className="mt-6 space-y-5">
              <div>
                <dt className="text-xs font-semibold text-emerald-950/45">
                  Name
                </dt>
                <dd className="mt-1 font-bold">{user.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-emerald-950/45">
                  Email
                </dt>
                <dd className="mt-1 truncate font-bold">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-emerald-950/45">
                  Role
                </dt>
                <dd className="mt-1 font-bold capitalize">
                  {user.role.toLowerCase()}
                </dd>
              </div>
            </dl>
          </article>
        </div>
      </section>
    </main>
  );
}
