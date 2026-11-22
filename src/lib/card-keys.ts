/**
 * What a screen reader hears on a snippet card's title button, after its
 * name, which is the snippet's title.
 *
 * The card is an `<article>` and its title is the button that opens the
 * preview (docs/adr/0072), so Enter and Space work the way they do on any
 * button. Moving a snippet from the keyboard is the card's Move button
 * (docs/adr/0073), since dragging is pointer only. dnd-kit's own
 * instructions, which say to press Space to pick the card up, are replaced
 * with ones that describe what works.
 */
export const CARD_INSTRUCTIONS =
  "Press Enter to open the snippet. To put it in a folder, use Move.";
