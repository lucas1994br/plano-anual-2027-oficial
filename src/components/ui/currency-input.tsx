import React, { useState, useEffect } from 'react';
import { Input } from './input';

<<<<<<< HEAD
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
=======
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
>>>>>>> ae6fc62ac3d6242de3e635029fd6df12f6a50aba

export interface CurrencyInputProps extends Omit<InputProps, 'onChange' | 'value' | 'defaultValue'> {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, defaultValue, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState('');

    useEffect(() => {
      const val = value !== undefined ? value : defaultValue;
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val);
        if (!isNaN(num)) {
          const formatted = num.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          setDisplayValue(formatted);
        } else {
          setDisplayValue('');
        }
      } else {
        setDisplayValue('');
      }
    }, [value, defaultValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
<<<<<<< HEAD
      const inputValue = e.target.value;
=======
      let inputValue = e.target.value;
>>>>>>> ae6fc62ac3d6242de3e635029fd6df12f6a50aba

      // Se o usuário digitou algo não numérico ou apagou tudo
      const digits = inputValue.replace(/\D/g, '');

      if (!digits) {
        setDisplayValue('');
        if (onChange) {
          // Cria um evento falso
          const event = {
            ...e,
            target: {
              ...e.target,
              value: '',
            },
          };
          onChange(event as React.ChangeEvent<HTMLInputElement>);
        }
        return;
      }

      const numericValue = parseInt(digits, 10) / 100;

      const formatted = numericValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      setDisplayValue(formatted);

      if (onChange) {
        const event = {
          ...e,
          target: {
            ...e.target,
            value: numericValue.toString(),
          },
        };
        onChange(event as React.ChangeEvent<HTMLInputElement>);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const digits = displayValue.replace(/\D/g, '');
      const numericValue = digits ? (parseInt(digits, 10) / 100).toString() : '';

      if (props.onBlur) {
        const event = {
          ...e,
          target: {
            ...e.target,
            value: numericValue,
          },
        };
        props.onBlur(event as React.FocusEvent<HTMLInputElement>);
      }
    };

    return (
      <Input
        {...props}
        type="text"
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
