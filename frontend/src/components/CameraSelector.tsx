import React from 'react';

interface Input {
  number: string;
  name: string;
}

interface CameraSelectorProps {
  inputs: Input[];
  onSelect: (inputNumber: number) => void;
}

const CameraSelector: React.FC<CameraSelectorProps> = ({ inputs, onSelect }) => {
  return (
    <div className="selector-container">
      <h1>Select Your Camera</h1>
      <div className="button-grid">
        {inputs.map((input) => (
          <button
            key={input.number}
            className="selector-button"
            onClick={() => onSelect(parseInt(input.number, 10))}
          >
            {input.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CameraSelector;