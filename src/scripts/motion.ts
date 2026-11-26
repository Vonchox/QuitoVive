let observer: IntersectionObserver | undefined;
document.addEventListener('astro:page-load', () => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paused = false;
  try { paused = localStorage.getItem('quitovive-motion') === 'paused'; } catch {}
  document.documentElement.classList.toggle('motion-paused', paused);
  const button = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');
  function updateButton() {
    if (!button) return;
    button.textContent = paused ? 'Activar animación ▷' : 'Pausar animación Ⅱ';
    button.setAttribute('aria-pressed', String(paused));
  }
  if (button && !reduced) {
    button.hidden = false;
    updateButton();
    button.addEventListener('click', () => {
      paused = !paused;
      document.documentElement.classList.toggle('motion-paused', paused);
      try { localStorage.setItem('quitovive-motion', paused ? 'paused' : 'playing'); } catch {}
      updateButton();
    });
  }
  observer?.disconnect();
  if (reduced || !('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('revealed');
      observer?.unobserve(entry.target);
    }
  }, { threshold: 0.05 });
  document.querySelectorAll('.event-card').forEach(card => {
    card.classList.add('reveal-card');
    observer!.observe(card);
  });
});
document.addEventListener('astro:before-swap', () => observer?.disconnect());
