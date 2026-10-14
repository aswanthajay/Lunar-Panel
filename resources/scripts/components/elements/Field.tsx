import React, { forwardRef } from 'react';
import { Field as FormikField, FieldProps } from 'formik';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';

interface OwnProps {
    name: string;
    light?: boolean;
    label?: string;
    description?: string;
    validate?: (value: any) => undefined | string | Promise<any>;
}

type Props = OwnProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'>;

const Field = forwardRef<HTMLInputElement, Props>(
    ({ id, name, light = false, label, description, validate, ...props }, ref) => (
        <FormikField innerRef={ref} name={name} validate={validate}>
            {({ field, form: { errors, touched } }: FieldProps) => (
                <div>
                    {label && (
                        <Label htmlFor={id} isLight={light}>
                            {label}
                        </Label>
                    )}
                    <Input
                        id={id}
                        {...field}
                        {...props}
                        isLight={light}
                        hasError={!!(touched[field.name] && errors[field.name])}
                    />
                    {touched[field.name] && errors[field.name] ? (
                        <p className={'text-[11px] font-medium text-red-400 mt-1 m-0'}>
                            {(errors[field.name] as string).charAt(0).toUpperCase() +
                                (errors[field.name] as string).slice(1)}
                        </p>
                    ) : description ? (
                        <p className={'text-[11px] text-zinc-500 mt-1 m-0'}>{description}</p>
                    ) : null}
                </div>
            )}
        </FormikField>
    )
);
Field.displayName = 'Field';

export default Field;
