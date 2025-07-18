import { useEffect, useRef } from 'react';

export const useTallyFeedback = (
  myInputNumber: number,
  programInput: number | null,
  previewInput: number | null,
  isVibrationEnabled: boolean,
  isSoundEnabled: boolean,
  speak: (text: string) => void
) => {
  const prevProgramInput = useRef<number | null>(null);
  const prevPreviewInput = useRef<number | null>(null);

  useEffect(() => {
    const isProgram = myInputNumber === programInput;
    const wasProgram = myInputNumber === prevProgramInput.current;
    const isPreview = myInputNumber === previewInput;
    const wasPreview = myInputNumber === prevPreviewInput.current;

    if (isProgram && !wasProgram) {
      if (isVibrationEnabled) navigator.vibrate?.(200);
      if (isSoundEnabled) speak('Cut');
    } else if (isPreview && !wasPreview) {
      if (isVibrationEnabled) navigator.vibrate?.([100, 50, 100]);
      if (isSoundEnabled) speak('Standby');
    }

    prevProgramInput.current = programInput;
    prevPreviewInput.current = previewInput;
  }, [myInputNumber, programInput, previewInput, isVibrationEnabled, isSoundEnabled, speak]);
};