"use client";

export function SokolLoader() {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative w-24 h-24">
        <svg
          viewBox="0 0 92.1 92.1"
          className="w-full h-full drop-shadow-xl animate-spin [animation-duration:3s]"
        >
          <circle
            cx="46.05"
            cy="46.05"
            r="46.05"
            fill="#e40521"
            className="animate-pulse"
          />

          <g className="fill-white">
            <path
              d="M46.1 2.4C22 2.4 2.4 22 2.4 46.1S22 89.7 46.1 89.7s43.6-19.5 43.6-43.6S70.2 2.4 46.1 2.4m0 84.9c-22.8 0-41.2-18.5-41.2-41.2 0-22.8 18.5-41.2 41.2-41.2s41.2 18.5 41.2 41.2c0 22.7-18.5 41.2-41.2 41.2m-8.2-28.8c-4.9-2.7-8.2-7.8-8.2-13.7C29.7 36.1 37 29 46.1 29c5.5 0 10.4 2.6 13.3 6.6V13.3h7.3v18.8h7.6v5.4H60.6c1.2 2.2 1.8 4.6 1.8 7.3v.7c-2.4-2-5.3-4-8.8-6-1.7-2.6-4.5-4.4-7.5-4.4-4.9 0-9.1 4.3-9.1 9.7 0 5.4 4.2 9.7 9.1 9.7.4 0 .8 0 1.2-.1 2.5 1.4 4.7 2.8 6.3 4.4-2.3 1.1-4.8 1.8-7.5 1.8-3 0-5.8-.8-8.2-2.1M32 59.6c2.8 6.9 9.3 12.7 16 12.7 5.4 0 9.5-2.7 9.5-8.1 0-7.3-8.7-10.5-16.7-14.9-.5-.3-1.2-.7-1.7-1.1-.4-1-.7-2.2-.7-3.3 0-4 2.8-7.4 6.3-8.1 2.2 1 4.7 2.1 7.1 3.5 13.3 7.4 17.8 14.2 17.8 22.1C69.7 74.3 59.5 81 49.2 81c-9.5 0-17.9-6.7-21.3-14.4v8.6h-7.3V50.9h7.3v7.9m.9-18.5c-2.7-3.1-4.6-7-4.6-11.8 0-10.4 9.5-17.6 20.6-17.6 5 0 9.5 1.8 13 4.5v9.4c-3.3-3.7-7.7-5.5-11.8-5.5-5.2 0-9.7 3.1-9.7 7.9 0 1 .2 2 .5 2.8-3.8 2.3-6.8 6-8 10.3"
              className="opacity-100 "
            />
            <path
              d="M25.3 61.5l9.8-10.2 4.4 4.1L26 69.2z"
              className="opacity-100"
            />
          </g>
        </svg>
      </div>

      <div className="text-center space-y-1">
        <h3 className="font-tyrs text-primary text-xl font-bold tracking-widest animate-pulse uppercase">
          Načítám dobrodružství
        </h3>
        <p className="font-fugner text-secondary text-xs uppercase tracking-tighter italic">
          Příprava mapy...
        </p>
      </div>
    </div>
  );
}
