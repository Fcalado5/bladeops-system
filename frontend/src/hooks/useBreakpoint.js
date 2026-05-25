import { useState, useEffect } from 'react';

export function useBreakpoint() {
  const [w, setW] = useState(window.innerWidth);

  useEffect(() => {
    let raf;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setW(window.innerWidth));
    };
    window.addEventListener('resize', handler, { passive: true });
    return () => {
      window.removeEventListener('resize', handler);
      cancelAnimationFrame(raf);
    };
  }, []);

  return {
    w,
    mobile:  w <= 768,
    tablet:  w > 768 && w <= 1024,
    desktop: w > 1024,
    sm:      w <= 480,
  };
}

export default useBreakpoint;