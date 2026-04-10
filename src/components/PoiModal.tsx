"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BadgeQuestionMark } from "lucide-react";

interface QuizQuestion {
  q: string;
  a: string[];
  c: number;
}

interface Poi {
  name: string;
  history_text?: string;
  quiz_data?: QuizQuestion[];
}

interface PoiModalProps {
  poi: Poi | null;
  isOpen: boolean;
  onClose: () => void;
  isUnlocked: boolean;
}

export function PoiModal({ poi, isOpen, onClose, isUnlocked }: PoiModalProps) {
  const [showQuiz, setShowQuiz] = useState(false);

  if (!poi) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            {poi.name}
          </DialogTitle>
          <DialogDescription>
            {isUnlocked
              ? "Bod úspěšně navštíven!"
              : "Tento bod je zatím zamčený."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isUnlocked ? (
            <p className="text-slate-500 italic">
              Musíš dojít k tomuto místu, abys odemkl jeho historii a kvíz.
            </p>
          ) : !showQuiz ? (
            <>
              <div className="prose prose-slate">
                <h4 className="font-bold">Něco z historie:</h4>
                <p className="text-sm leading-relaxed text-slate-700">
                  {poi.history_text ||
                    "K tomuto místu zatím nemáme žádný příběh, ale i tak je tu krásně!"}
                </p>
              </div>
              <Button
              variant="default"
              size="lg"
              className="flex items-center gap-2 text-base m-auto text-white"
               onClick={() => setShowQuiz(true)}>
                <BadgeQuestionMark />CHCI ODPOVĚDĚT NA KVÍZ
              </Button>
            </>
          ) : (
            <div className="space-y-6">
              <h4 className="font-bold text-secondary text-center uppercase tracking-wider">
                Kvízové otázky
              </h4>
              {poi.quiz_data &&
                poi.quiz_data.map((item: QuizQuestion, qIdx: number) => (
                  <div
                    key={qIdx}
                    className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-100"
                  >
                    <p className="font-bold text-slate-800 text-sm">{item.q}</p>
                    <div className="grid gap-2">
                      {item.a.map((option: string, optIdx: number) => (
                        <Button
                          key={optIdx}
                          variant="outline"
                          className="justify-start text-left h-auto py-2 px-4 hover:bg-blue-50 transition-colors text-sm"
                          onClick={() => {
                            if (optIdx === item.c) {
                              alert("Správně! 🌟");
                            } else {
                              alert("To není ono, zkus to znovu. 🧐");
                            }
                          }}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowQuiz(false)}
              >
                ZPĚT NA HISTORII
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
