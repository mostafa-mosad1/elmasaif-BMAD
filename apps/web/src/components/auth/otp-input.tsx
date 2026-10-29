'use client';

import React, { useRef, useEffect } from 'react';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
  autoFocus = true
}: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Array of 6 characters
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && inputsRef.current[0] && !disabled) {
      inputsRef.current[0].focus();
    }
  }, [autoFocus, disabled]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.slice(-1); // grab last char typed
    if (!/^[0-9]$/.test(char) && char !== '') {
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = char;
    const nextVal = newDigits.join('');
    onChange(nextVal);

    if (char && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    if (nextVal.length === 6 && onComplete) {
      onComplete(nextVal);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    const numericChars = pastedData.replace(/\D/g, '').slice(0, 6);
    if (!numericChars) return;

    onChange(numericChars);

    const targetIndex = Math.min(numericChars.length, 5);
    inputsRef.current[targetIndex]?.focus();

    if (numericChars.length === 6 && onComplete) {
      onComplete(numericChars);
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3" dir="ltr">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-mono font-bold rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 select-all ${
            hasError
              ? 'border-status-danger text-status-danger bg-status-dangerBg/10 focus:ring-status-danger/30'
              : digit
              ? 'border-primary text-ink-primary dark:text-dark-ink-primary bg-surface-base dark:bg-dark-surface-base focus:ring-primary/20'
              : 'border-surface-border dark:border-dark-surface-border text-ink-primary dark:text-dark-ink-primary bg-surface-sunken dark:bg-dark-surface-raised focus:ring-primary/20 focus:border-primary'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}

