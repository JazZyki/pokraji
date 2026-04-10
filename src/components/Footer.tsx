"use client";
import { Button } from "@/components/ui/button";

export function Footer() {
  return (
    <footer className="fixed bottom-0 w-full bg-secondary text-white text-center p-4 mt-8">
      <p className="text-sm mb-1">
        &copy; {new Date().getFullYear()} <strong>PoKraji</strong>. Všechna práva vyhrazena.
      </p>
      <p className="text-xs mb-1">
        Programmed and designed by{" "}
        <Button
          variant="link"
          size="link"
          onClick={() => window.open("https://jazzyki.cz", "_blank")}
        >
          Jakub Zykl
        </Button>
      </p>
    </footer>
  );
}
