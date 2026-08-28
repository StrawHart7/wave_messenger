import { palettes, radii, spacing, typography } from '../tokens';

/**
 * These assert the values DESIGN.md fixes. They are not change-detector tests: if one
 * fails, either the reference changed (update both) or someone drifted from it.
 */
describe('design tokens', () => {
  it('keeps the messaging semantics the reference screens depend on', () => {
    expect(palettes.light.messaging.accent).toBe('#25D366');
    expect(palettes.light.messaging.bubbleOutgoing).toBe('#D9FDD3');
    expect(palettes.dark.messaging.bubbleOutgoing).toBe('#005C4B');
    expect(palettes.light.messaging.tickRead).toBe('#53BDEB');
    expect(palettes.dark.messaging.tickRead).toBe('#53BDEB');
  });

  it('defines every tide role in both schemes', () => {
    expect(Object.keys(palettes.dark.tide).sort()).toEqual(Object.keys(palettes.light.tide).sort());
    expect(Object.keys(palettes.dark.messaging).sort()).toEqual(
      Object.keys(palettes.light.messaging).sort(),
    );
  });

  it('holds the geometry the reference fixes', () => {
    // 12, not the 7.5 named in DESIGN.md's prose: the polished conversation screens
    // draw 12px bubbles, and the screens outrank the prose.
    expect(radii.bubble).toBe(12);
    expect(radii.bubbleTail).toBe(2);
    expect(spacing.listItemHeight).toBe(72);
    expect(spacing.edgeMargin).toBe(16);
    expect(spacing.avatarLg).toBe(48);
    expect(spacing.avatarSm).toBe(32);
    expect(spacing.bubblePaddingH).toBe(12);
    expect(spacing.bubblePaddingV).toBe(8);
  });

  it('uses only the three permitted weights', () => {
    const weights = new Set(Object.values(typography).map((role) => role.weight));
    expect([...weights].sort()).toEqual(['400', '500', '600']);
  });

  it('keeps the mobile reading size at 15px for message body', () => {
    expect(typography.messageBody.fontSize).toBe(15);
    expect(typography.chatName.fontSize).toBe(16);
    expect(typography.navTitle.fontSize).toBe(17);
  });

  it('gives both themes the same number of group sender colours', () => {
    // senderTintIndex hashes into this ring. Rings of different lengths would move
    // a person's name colour when the theme changes.
    expect(palettes.light.messaging.senderTints).toHaveLength(
      palettes.dark.messaging.senderTints.length,
    );
    expect(palettes.light.messaging.senderTints.length).toBeGreaterThan(1);
  });
});
