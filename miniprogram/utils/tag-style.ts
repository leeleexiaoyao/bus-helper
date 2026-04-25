export interface TagColorView {
  label: string;
  style: string;
}

const TAG_COLORS: Array<{ color: string; background: string }> = [
  { color: "#689B04", background: "rgba(104, 155, 4, 0.1)" },
  { color: "#2B91FF", background: "rgba(43, 145, 255, 0.1)" },
  { color: "#9152FC", background: "rgba(145, 82, 252, 0.1)" },
  { color: "#FE6C0A", background: "rgba(254, 108, 10, 0.1)" },
  { color: "#0A9F8F", background: "rgba(10, 159, 143, 0.1)" },
  { color: "#D84B7A", background: "rgba(216, 75, 122, 0.1)" },
  { color: "#A57900", background: "rgba(165, 121, 0, 0.1)" },
  { color: "#4A7DFF", background: "rgba(74, 125, 255, 0.1)" },
  { color: "#A04BCB", background: "rgba(160, 75, 203, 0.1)" },
  { color: "#27945B", background: "rgba(39, 148, 91, 0.1)" }
];

export function buildTagColorViews(tags: string[], limit = TAG_COLORS.length): TagColorView[] {
  const seed = tags.join("|").split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  const startIndex = seed % TAG_COLORS.length;
  return tags.slice(0, limit).map((tag, index) => {
    const color = TAG_COLORS[(startIndex + index) % TAG_COLORS.length];
    return {
      label: tag,
      style: `color: ${color.color}; background: ${color.background};`
    };
  });
}
