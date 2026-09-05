import React from 'react';
import { Actions, State, useStoreActions, useStoreState } from 'easy-peasy';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Field from '@/components/elements/Field';
import { httpErrorToHuman } from '@/api/http';
import { ApplicationStore } from '@/state';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';

interface Values {
    username: string;
    name_first: string;
    name_last: string;
    password: string;
}

const schema = Yup.object().shape({
    username: Yup.string()
        .min(1, 'Username must be at least 1 character.')
        .max(191, 'Username may not exceed 191 characters.')
        .required('Username is required.'),
    name_first: Yup.string()
        .min(1, 'First name must be at least 1 character.')
        .max(191, 'First name may not exceed 191 characters.')
        .required('First name is required.'),
    name_last: Yup.string()
        .min(1, 'Last name must be at least 1 character.')
        .max(191, 'Last name may not exceed 191 characters.')
        .required('Last name is required.'),
    password: Yup.string().required('You must provide your current account password to confirm identity.'),
});

interface Props {
    onSuccess?: () => void;
}

export default ({ onSuccess }: Props) => {
    const user = useStoreState((state: State<ApplicationStore>) => state.user.data);
    const updateUserProfile = useStoreActions((state: Actions<ApplicationStore>) => state.user.updateUserProfile);
    const { clearFlashes, addFlash } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    if (!user) {
        return null;
    }

    const submit = (values: Values, { resetForm, setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('account:profile');

        updateUserProfile(values)
            .then(() => {
                addFlash({
                    type: 'success',
                    key: 'account:profile',
                    message: 'Your profile details have been updated successfully.',
                });
                resetForm({ values: { ...values, password: '' } });
                if (onSuccess) {
                    onSuccess();
                }
            })
            .catch((error) =>
                addFlash({
                    type: 'error',
                    key: 'account:profile',
                    title: 'Error',
                    message: httpErrorToHuman(error),
                })
            )
            .finally(() => {
                setSubmitting(false);
            });
    };

    return (
        <Formik
            onSubmit={submit}
            validationSchema={schema}
            initialValues={{
                username: user.username || '',
                name_first: user.nameFirst || '',
                name_last: user.nameLast || '',
                password: '',
            }}
            enableReinitialize
        >
            {({ isSubmitting, isValid }) => (
                <React.Fragment>
                    <SpinnerOverlay size={'large'} visible={isSubmitting} />
                    <Form css={tw`m-0`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Field
                                id={'name_first'}
                                type={'text'}
                                name={'name_first'}
                                label={'First Name'}
                                description={'Your legal first name.'}
                            />
                            <Field
                                id={'name_last'}
                                type={'text'}
                                name={'name_last'}
                                label={'Last Name'}
                                description={'Your legal last name.'}
                            />
                        </div>
                        <div css={tw`mt-6`}>
                            <Field
                                id={'username'}
                                type={'text'}
                                name={'username'}
                                label={'Username'}
                                description={'Your public handle and login username identifier.'}
                            />
                        </div>
                        <div css={tw`mt-6`}>
                            <Field
                                id={'profile_password'}
                                type={'password'}
                                name={'password'}
                                label={'Confirm Current Password'}
                                description={'Enter your account password to authorize these profile modifications.'}
                            />
                        </div>
                        <div css={tw`mt-6`}>
                            <Button disabled={isSubmitting || !isValid}>Save Profile Changes</Button>
                        </div>
                    </Form>
                </React.Fragment>
            )}
        </Formik>
    );
};
