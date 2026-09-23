/** Neutral vocatives also when replaying a turn saved before the audiovisual correction. */
export function spokenText(text: string) {
  const neutral = text
    .replace(/^doutor(?:\(a\)|a)?,\s*/i, "")
    .replace(/,\s*doutor(?:\(a\)|a)?(?=[,.?!])/gi, "")
    .replace(/\bdoutor(?:\(a\)|a)?,\s*/gi, "");
  return neutral.charAt(0).toUpperCase() + neutral.slice(1);
}
