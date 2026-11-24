// Light formatting for support replies. Models and teammates write a little
// Markdown (**bold**, `code`, [links](https://…)); the chat shows it as text
// styling instead of raw markers. Nothing here produces HTML: callers render
// the returned tokens as React elements, so message text can never inject markup.

export type MessageToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

// "[Source: domain setup guide]" and similar tags duplicate the citation links
// shown under each reply.
const SOURCE_TAG = /[ \t]*[([](?:sources?|citations?|ref(?:erence)?s?)\s*:[^\])\n]{0,200}[\])]/gi;

export function stripSourceTags(text: string) {
  return text.replace(SOURCE_TAG, "").replace(/[ \t]+$/gm, "");
}

const INLINE =
  /\*\*([^*\n][^*\n]*?)\*\*|__([^_\n][^_\n]*?)__|`([^`\n]+)`|\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]{1,2000})\)/g;

export function messageTokens(text: string): MessageToken[] {
  const tokens: MessageToken[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) tokens.push({ type: "text", text: text.slice(last, at) });
    const [, bold, underscored, code, label, href] = match;
    if (bold ?? underscored) tokens.push({ type: "bold", text: (bold ?? underscored)! });
    else if (code) tokens.push({ type: "code", text: code });
    else if (label && href) tokens.push({ type: "link", text: label, href });
    last = at + match[0].length;
  }
  if (last < text.length) tokens.push({ type: "text", text: text.slice(last) });
  return tokens;
}
