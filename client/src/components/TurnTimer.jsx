import React, { useEffect, useState, useRef } from 'react';

export default function TurnTimer({ startedAt, limit = 25, onWarn }) {
  const [remaining, setRemaining] = useState(limit);
  const warnFiredRef = useRef(false);

  useEffect(() => {
    warnFiredRef.current = false;
    const update = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const rem = Math.max(0, limit - elapsed);
      setRemaining(rem);

      // 10초 경고 1회 콜백
      if (rem <= 10 && !warnFiredRef.current) {
        warnFiredRef.current = true;
        onWarn?.();
      }
    };
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [startedAt, limit]);

  const pct      = remaining / limit;
  const warn     = remaining <= 10;
  const critical = remaining <= 5;

  return (
    <div className="px-4 pb-1">
      <div className="flex items-center gap-2">
        <span className={[
          'text-xs font-black w-6 text-right tabular-nums',
          critical ? 'text-red-400 animate-pulse' : warn ? 'text-orange-400' : 'text-white/60',
        ].join(' ')}>
          {Math.ceil(remaining)}
        </span>
        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={[
              'h-full rounded-full',
              critical ? 'bg-red-500 animate-pulse-red' : warn ? 'bg-orange-400' : 'bg-blue-400',
            ].join(' ')}
            style={{ width: `${pct * 100}%`, transition: 'width 0.2s linear, background-color 0.3s' }}
          />
        </div>
        <span className="text-xs text-white/30">s</span>
      </div>
    </div>
  );
}
