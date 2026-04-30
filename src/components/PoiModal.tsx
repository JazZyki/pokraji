"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BadgeQuestionMark, CheckCircle2, XCircle } from "lucide-react";

interface QuizQuestion {
  q: string;
  a: string[];
  c: number;
}

interface Poi {
  id: string;
  name: string;
  title?: string;
  history_text?: string;
  quiz_data?: QuizQuestion | QuizQuestion[] | string;
}

interface PoiModalProps {
  poi: Poi | null;
  isOpen: boolean;
  onClose: () => void;
  isUnlocked: boolean;
  savedResponses?: Record<number, number>;
  onAnswer?: (poiId: string, questionIdx: number, answerIdx: number) => void;
}

export function PoiModal({
  poi,
  isOpen,
  onClose,
  isUnlocked,
  savedResponses = {},
  onAnswer = () => {},
}: PoiModalProps) {
  const [showQuiz, setShowQuiz] = useState(false);
  // Lokální stav pro okamžitou odezvu UI, inicializovaný z DB
  const [localAnswers, setLocalAnswers] =
    useState<Record<number, number>>(savedResponses);

  // Synchronizace s DB, když se změní vybraný bod nebo přijdou nová data
  React.useEffect(() => {
    setLocalAnswers(savedResponses);
  }, [savedResponses, poi?.id]);

  if (!poi) return null;

  // Resetovat lokální zobrazení při zavření
  const handleClose = () => {
    setShowQuiz(false);
    onClose();
  };

  // Normalizace kvízových dat
  const questions: QuizQuestion[] = React.useMemo(() => {
    if (!poi.quiz_data) return [];

    let rawData: unknown = poi.quiz_data;
    if (typeof rawData === "string") {
      try {
        rawData = JSON.parse(rawData);
      } catch (e) {
        return [];
      }
    }

    const arr = Array.isArray(rawData) ? rawData : [rawData];

    return arr
      .map((item: unknown) => {
        if (typeof item !== "object" || item === null) return null;
        const obj = item as Record<string, unknown>;

        if (obj.q && Array.isArray(obj.a)) {
          return {
            q: String(obj.q),
            a: obj.a.map(String),
            c: typeof obj.c === "number" ? obj.c : 0,
          };
        }
        if (obj.question && Array.isArray(obj.options)) {
          const options = obj.options.map(String);
          return {
            q: String(obj.question),
            a: options,
            c:
              options.indexOf(String(obj.answer)) !== -1
                ? options.indexOf(String(obj.answer))
                : 0,
          };
        }
        return null;
      })
      .filter((q): q is QuizQuestion => q !== null);
  }, [poi.quiz_data]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            {poi.title || poi.name}
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
              <div className="prose prose-slate prose-sm max-w-none">
                {/* Zde zobrazíš nový titulek */}
                <div
                  className="leading-relaxed text-slate-700"
                  dangerouslySetInnerHTML={{ __html: poi.history_text || "" }}
                />
              </div>
              <Button
                variant="default"
                size="lg"
                className="flex items-center gap-2 text-base m-auto text-white"
                onClick={() => setShowQuiz(true)}
              >
                <BadgeQuestionMark />
                CHCI ODPOVĚDĚT NA KVÍZ
              </Button>
            </>
          ) : (
            <div className="space-y-6">
              <h4 className="font-bold text-secondary text-center uppercase tracking-wider">
                Kvízové otázky
              </h4>
              {questions.map((item: QuizQuestion, qIdx: number) => {
                const selectedIdx = localAnswers[qIdx];
                const isAnswered = selectedIdx !== undefined;

                return (
                  <div
                    key={qIdx}
                    className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-100"
                  >
                    <p className="font-bold text-slate-800 text-sm">{item.q}</p>
                    <div className="grid gap-2">
                      {item.a.map((option: string, optIdx: number) => {
                        const isCorrect = optIdx === item.c;
                        const isSelected = selectedIdx === optIdx;

                        let variant:
                          | "outline"
                          | "default"
                          | "destructive"
                          | "secondary" = "outline";
                        let className =
                          "justify-start text-left h-auto py-2 px-4 transition-all text-sm";

                        if (isAnswered) {
                          if (isCorrect) {
                            className +=
                              " bg-green-100 border-green-500 text-green-700 hover:bg-green-100";
                          } else if (isSelected) {
                            className +=
                              " bg-red-100 border-red-500 text-red-700 hover:bg-red-100";
                          } else {
                            className += " opacity-50 cursor-not-allowed";
                          }
                        }

                        return (
                          <Button
                            key={optIdx}
                            variant={variant}
                            disabled={isAnswered}
                            className={className}
                            onClick={() => {
                              setLocalAnswers((prev) => ({
                                ...prev,
                                [qIdx]: optIdx,
                              }));
                              onAnswer(poi.id, qIdx, optIdx);
                            }}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <span className="flex-grow">{option}</span>
                              {isAnswered && isCorrect && (
                                <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                              )}
                              {isAnswered && isSelected && !isCorrect && (
                                <XCircle className="size-4 text-red-600 shrink-0" />
                              )}
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
