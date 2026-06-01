/**
 * Returns true when the event target is an element that accepts text input,
 * so global single-key shortcuts should not hijack the keystroke.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable === true
  );
}

/**
 * Returns true when the currently focused element natively handles
 * Enter/Space activation. In that case the window-level shortcut should
 * defer to the browser to avoid triggering the action twice.
 */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === 'BUTTON' || tag === 'A' || isTypingTarget(node);
}
