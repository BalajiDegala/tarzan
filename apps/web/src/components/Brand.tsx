import { Link } from 'react-router-dom';

export function Brand() {
  return (
    <Link
      className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-300"
      to="/"
      aria-label="Tarzan home"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-lime-300 font-black text-[#07130f] shadow-lg shadow-lime-950/20">
        T
      </span>
      <span className="text-lg font-bold tracking-tight text-stone-100">
        Tarzan
      </span>
    </Link>
  );
}
