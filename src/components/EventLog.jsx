import { useEffect, useRef } from 'react';

export default function EventLog({ events }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [events]);

  if (!events?.length) return null;

  return (
    <div className="event-log" ref={ref}>
      {[...events].reverse().map((e, i) => (
        <p key={e.id} className={i === 0 ? 'fresh' : ''}>
          {e.text}
        </p>
      ))}
    </div>
  );
}
