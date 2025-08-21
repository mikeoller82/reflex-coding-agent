
import React from 'react';

type AlphaBoxProps = {
  className?: string;
};

export default function AlphaBox(props: AlphaBoxProps) {
  const { className } = props;
  return (
    <div className={className} data-component="AlphaBox">
      AlphaBox component
    </div>
  );
}
