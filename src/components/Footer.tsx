"use client";
import { Button } from "@/components/ui/button";
import packageJson from "../../package.json";

export function Footer() {
  const version = packageJson.version;

  return (
    <footer className="fixed bottom-0 w-full bg-secondary text-white text-center p-4 mt-8">
      <p className="text-sm mb-1">
        &copy; {new Date().getFullYear()} <strong>PoKraji</strong>. Všechna práva vyhrazena.
      </p>
      <p className="text-xs mb-1">
        v{version} {" | "}
        Programmed and designed by{" "}
        <Button
          variant="link"
          size="link"
          onClick={() => window.open("https://jazzyki.cz", "_blank")}
        >
          Jakub Zykl
        </Button>
        {" | "}
        <Button
          variant="link"
          size="link"
          onClick={() => window.location.href = "/admin"}
          className="text-[10px] opacity-30 hover:opacity-100"
        >
          Admin
        </Button>
      </p>
    </footer>
  );
}
