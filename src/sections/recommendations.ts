import { revealTitleByLetter } from './skills';

export function initRecommendations() {
  const section = document.querySelector<HTMLElement>('.recs-section');
  if (!section) return;

  revealTitleByLetter(section.querySelector('.recs-title'), section, 'art-title-letter');
  // The cards themselves carry data-simple-reveal, handled by initSimpleReveal.
}
