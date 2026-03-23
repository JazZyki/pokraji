interface SokolTextProps {
  text: string;
  className?: string;
}

export function SokolText({ text, className = "" }: SokolTextProps) {
  const words = text.split(" ");

  // Pokud je jen jedno slovo, půlka písmen bude Tyrs, půlka Fugner
  if (words.length === 1) {
    const middle = Math.ceil(text.length / 2);
    return (
      <span className={className}>
        <span className="font-tyrs">{text.slice(0, middle)}</span>
        <span className="font-fugner">{text.slice(middle)}</span>
      </span>
    );
  }

  // U více slov rozdělíme slova na poloviny
  const middleIndex = Math.ceil(words.length / 2);
  const firstHalf = words.slice(0, middleIndex).join(" ");
  const secondHalf = words.slice(middleIndex).join(" ");

  return (
    <span className={className}>
      <span className="font-tyrs">{firstHalf} </span>
      <span className="font-fugner">{secondHalf}</span>
    </span>
  );
}
