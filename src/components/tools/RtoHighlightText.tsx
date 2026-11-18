interface RtoHighlightTextProps {
  text: string;
  query: string;
}

export function RtoHighlightText({ text, query }: RtoHighlightTextProps) {
  const trimmed = query.trim();
  if (!trimmed || !text) {
    return <>{text}</>;
  }

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'ig');
  const parts = text.split(regex);

  if (parts.length <= 1) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark
            key={`${part}-${idx}`}
            className="bg-[#F9C80E] text-[#2F3E4E] px-0.5 rounded-xs font-semibold"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${idx}`}>{part}</span>
        )
      )}
    </>
  );
}
