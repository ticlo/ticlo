export const deckAnimations = ['none', 'slide', 'fade', 'zoom', 'custom'] as const;
const timing = {duration: 300, easing: 'ease', fill: 'both' as const};
type Effect = Keyframe[] | string;
type Frames = {incoming?: Effect; outgoing?: Effect};

const presets: Record<string, (forward: boolean) => Frames> = {
  fade: () => ({incoming: [{opacity: 0}, {opacity: 1}]}),
  slide: (forward) => ({
    incoming: [{transform: `translateX(${forward ? 100 : -100}%)`}, {transform: 'translateX(0)'}],
    outgoing: [{transform: 'translateX(0)'}, {transform: `translateX(${forward ? -100 : 100}%)`}],
  }),
  zoom: () => ({
    incoming: [
      {transform: 'scale(0.94)', opacity: 0},
      {transform: 'scale(1)', opacity: 1},
    ],
    outgoing: [
      {transform: 'scale(1)', opacity: 1},
      {transform: 'scale(1.06)', opacity: 0},
    ],
  }),
};

export function getDeckAnimation(
  animation: unknown,
  forward: boolean,
  showEffect: unknown,
  hideEffect: unknown
): Frames | undefined {
  if (animation === 'custom') {
    const incoming = typeof showEffect === 'string' ? showEffect.trim() : '';
    const outgoing = typeof hideEffect === 'string' ? hideEffect.trim() : '';
    return incoming || outgoing ? {incoming, outgoing} : undefined;
  }
  if (typeof animation !== 'string' || !Object.hasOwn(presets, animation)) return undefined;
  return presets[animation](forward);
}

export function animateDeckLayer(layer: HTMLElement, effect: Effect): Animation[] {
  if (!effect) return [];
  if (typeof effect !== 'string') return [layer.animate(effect, timing)];
  layer.style.animation = `${timing.duration}ms ${timing.easing} both`;
  layer.style.animationName = effect;
  return layer.getAnimations();
}
