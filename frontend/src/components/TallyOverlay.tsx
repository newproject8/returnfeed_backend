import React from 'react';

interface TallyOverlayProps {
  programInput: number | null;
  previewInput: number | null;
  myInputNumber: number; // 사용자가 선택한 자신의 카메라 번호
  children: React.ReactNode;
}

const TallyOverlay: React.FC<TallyOverlayProps> = ({
  programInput,
  previewInput,
  myInputNumber,
  children,
}) => {
  let tallyClass = '';
  if (myInputNumber === programInput) {
    tallyClass = 'tally-program'; // On-Air
  } else if (myInputNumber === previewInput) {
    tallyClass = 'tally-preview'; // Standby
  }

  return <div className={`tally-container ${tallyClass}`}>{children}</div>;
};

export default TallyOverlay;