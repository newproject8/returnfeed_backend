import { useState, useEffect, useCallback } from 'react';

const useSpeechSynthesis = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preferredVoice, setPreferredVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
      }
    };
    // Voices are loaded asynchronously
    speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  useEffect(() => {
    if (voices.length > 0 && !preferredVoice) {
      // Find the best male voice based on keywords
      const maleVoiceKeywords = ['male', 'man', '남성', 'google us english', 'david', 'mark'];
      let bestVoice: SpeechSynthesisVoice | null = null;

      for (const keyword of maleVoiceKeywords) {
        bestVoice = voices.find(v => v.name.toLowerCase().includes(keyword)) || null;
        if (bestVoice) break;
      }
      setPreferredVoice(bestVoice || voices[0]); // Fallback to the first voice
    }
  }, [voices, preferredVoice]);

  const speak = useCallback((text: string) => {
    if (!preferredVoice) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = preferredVoice;
    
    // Robust queue management
    speechSynthesis.cancel(); 
    speechSynthesis.speak(utterance);
  }, [preferredVoice]);

  return { speak };
};

export default useSpeechSynthesis;