import { revealTitleByLetter } from './skills';

/**
 * Boarding passes. Each card carries its own destination in data attributes and
 * opens a gallery of that place's photographs plus a short note.
 *
 * A native <dialog> does the work: focus trapping, Escape and the backdrop all
 * come from the platform rather than being reimplemented here.
 */
function initTravelStories(section: HTMLElement) {
  const dialog = document.querySelector<HTMLDialogElement>('.travel-story');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const gallery = dialog.querySelector<HTMLElement>('.travel-story-gallery');
  const place = dialog.querySelector<HTMLElement>('.travel-story-place');
  const body = dialog.querySelector<HTMLElement>('.travel-story-body');
  const count = dialog.querySelector<HTMLElement>('.travel-story-count');
  const close = dialog.querySelector<HTMLButtonElement>('.travel-story-close');
  if (!gallery || !place || !body) return;

  /*
   * Only the first five photographs were re-exported at full size. The rest fall
   * back to the grid-sized file, which is still large enough to fill the panel.
   */
  const FULL_SIZED = new Set(['travel-1', 'travel-2', 'travel-3', 'travel-4', 'travel-5']);

  section.querySelectorAll<HTMLButtonElement>('button.pass').forEach((pass) => {
    pass.addEventListener('click', () => {
      const title = pass.dataset.title ?? '';
      const names = (pass.dataset.photos ?? '').split(',').filter(Boolean);

      gallery.textContent = '';
      names.forEach((name, i) => {
        const img = document.createElement('img');
        img.src = FULL_SIZED.has(name) ? `/${name}-full.jpg` : `/${name}.jpg`;
        img.alt = names.length > 1 ? `${title}, photograph ${i + 1}` : title;
        // The first is on screen the moment the panel opens; the rest can wait.
        img.loading = i === 0 ? 'eager' : 'lazy';
        img.decoding = 'async';
        gallery.appendChild(img);
      });

      if (count) count.textContent = names.length > 1 ? `${names.length} photographs` : '1 photograph';
      place.textContent = title;
      body.textContent = pass.dataset.story ?? '';
      gallery.scrollTop = 0;
      dialog.showModal();
    });
  });

  close?.addEventListener('click', () => dialog.close());

  // Clicking the backdrop closes it; clicks on the panel itself must not.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  // Drop the images once it is shut, so seven photographs are not held in memory.
  dialog.addEventListener('close', () => {
    gallery.textContent = '';
  });
}

export function initTravel() {
  const section = document.querySelector<HTMLElement>('.travel-section');
  if (!section) return;

  revealTitleByLetter(section.querySelector('.travel-title'), section, 'art-title-letter');
  initTravelStories(section);
}
