"use client";

// Lecture vocale (SpeechSynthesis) — bouton « Écouter » des sensibilisations
// (maquette PO 2026-10). Aucune dépendance : API navigateur, voix fr-FR.
// Si l'API n'est pas disponible, le composant appelant masque le bouton.
//
// Note règles React : aucun setState synchronement dans un effet — quand la
// lecture est coupée (changement de texte / démontage), seul `cancel()` est
// appelé ; l'événement `end`/`error` de l'utterance interrompue remet l'état.
import { useCallback, useEffect, useState } from "react";

export function useSpeech(text: string | null) {
  const [speaking, setSpeaking] = useState(false);
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
  );

  // Coupe la synthèse sans toucher à l'état (utilisable dans un effet).
  const cancelSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const stop = useCallback(() => {
    cancelSpeech();
    setSpeaking(false);
  }, [cancelSpeech]);

  const start = useCallback(() => {
    if (!text || !supported) return;
    cancelSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }, [text, supported, cancelSpeech]);

  // Changement de texte → on coupe (l'utterance annulée émet end/error).
  useEffect(() => {
    cancelSpeech();
  }, [text, cancelSpeech]);

  // Démontage → jamais de voix orpheline.
  useEffect(() => cancelSpeech, [cancelSpeech]);

  const toggle = useCallback(() => {
    if (speaking) {
      stop();
    } else {
      start();
    }
  }, [speaking, start, stop]);

  return { speaking, supported, start, stop, toggle };
}
