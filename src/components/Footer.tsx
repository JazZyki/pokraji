import Link from "next/link";

export function Footer() {
  return (
    <footer className="fixed bottom-0 w-full bg-secondary text-white text-center p-4 mt-8">
      <p className="text-sm">
        &copy; {new Date().getFullYear()} PoKraji. Všechna práva vyhrazena.
      </p>
      <p className="text-xs mt-1">
        Programmed and designed by{" "}
        <Link href={"https://jazzyki.cz"} target="_blank">
          Jakub Zykl
        </Link>
      </p>
    </footer>
  );
}
