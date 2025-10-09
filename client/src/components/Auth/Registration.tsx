import { useForm } from 'react-hook-form';
import React, { useContext, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { Eye, EyeOff } from 'lucide-react';
import { ThemeContext, Spinner, Button, isDark } from '@librechat/client';
import { useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { useRegisterUserMutation, useAviRolesQuery, useAviSubrolesQuery } from 'librechat-data-provider/react-query';
import type { TRegisterUser, TError } from 'librechat-data-provider';
import type { TLoginLayoutContext } from '~/common';
import { useLocalize, TranslationKeys } from '~/hooks';
import { ErrorMessage } from './ErrorMessage';

const Registration: React.FC = () => {
  const navigate = useNavigate();
  const localize = useLocalize();
  const { theme } = useContext(ThemeContext);
  const { startupConfig, startupConfigError, isFetching } = useOutletContext<TLoginLayoutContext>();

  const {
    watch,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TRegisterUser>({ mode: 'onChange' });
  const password = watch('password');
  const selectedAviRol = watch('aviRol_id');

  // AVI Roles queries
  const { data: aviRoles = [] } = useAviRolesQuery();
  const { data: aviSubroles = [] } = useAviSubrolesQuery(selectedAviRol || '');

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number>(3);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');
  const validTheme = isDark(theme) ? 'dark' : 'light';

  // only require captcha if we have a siteKey
  const requireCaptcha = Boolean(startupConfig?.turnstile?.siteKey);

  const registerUser = useRegisterUserMutation({
    onMutate: () => {
      setIsSubmitting(true);
    },
    onSuccess: () => {
      setIsSubmitting(false);
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown((prevCountdown) => {
          if (prevCountdown <= 1) {
            clearInterval(timer);
            navigate('/c/new', { replace: true });
            return 0;
          } else {
            return prevCountdown - 1;
          }
        });
      }, 1000);
    },
    onError: (error: unknown) => {
      setIsSubmitting(false);
      if ((error as TError).response?.data?.message) {
        setErrorMessage((error as TError).response?.data?.message ?? '');
      }
    },
  });

  const renderInput = (
    id: string,
    label: TranslationKeys,
    type: string,
    validation: object,
    showToggle?: boolean,
    isVisible?: boolean,
    onToggle?: () => void,
  ) => (
    <div className="mb-4">
      <div className="relative">
        <input
          id={id}
          type={showToggle && isVisible ? 'text' : type}
          autoComplete={id}
          aria-label={localize(label)}
          {...register(
            id as 'name' | 'email' | 'username' | 'password' | 'confirm_password',
            validation,
          )}
          aria-invalid={!!errors[id]}
          className={`webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pt-3 ${
            showToggle ? 'pr-10' : ''
          } text-text-primary duration-200 focus:border-green-500 focus:outline-none ${
            type === 'password' ? '[&::-ms-reveal]:hidden' : ''
          }`}
          placeholder=" "
          data-testid={id}
        />
        <label
          htmlFor={id}
          className="absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-500 rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4"
        >
          {localize(label)}
        </label>
        {showToggle && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-text-secondary transition-colors hover:text-text-primary focus:outline-none"
            aria-label={isVisible ? 'Hide password' : 'Show password'}
          >
            <span className="flex h-5 w-5 items-center justify-center">
              {isVisible ? (
                <EyeOff key="eye-off" className="h-5 w-5" />
              ) : (
                <Eye key="eye-on" className="h-5 w-5" />
              )}
            </span>
          </button>
        )}
      </div>
      {errors[id] && (
        <span role="alert" className="mt-1 text-sm text-red-500">
          {String(errors[id]?.message) ?? ''}
        </span>
      )}
    </div>
  );

  return (
    <>
      {errorMessage && (
        <ErrorMessage>
          {localize('com_auth_error_create')} {errorMessage}
        </ErrorMessage>
      )}
      {registerUser.isSuccess && countdown > 0 && (
        <div
          className="rounded-md border border-green-500 bg-green-500/10 px-3 py-2 text-sm text-gray-600 dark:text-gray-200"
          role="alert"
        >
          {localize(
            startupConfig?.emailEnabled
              ? 'com_auth_registration_success_generic'
              : 'com_auth_registration_success_insecure',
          ) +
            ' ' +
            localize('com_auth_email_verification_redirecting', { 0: countdown.toString() })}
        </div>
      )}
      {!startupConfigError && !isFetching && (
        <>
          <form
            className="mt-6"
            aria-label="Registration form"
            method="POST"
            onSubmit={handleSubmit((data: TRegisterUser) =>
              registerUser.mutate({ ...data, token: token ?? undefined }),
            )}
          >
            {renderInput('name', 'com_auth_full_name', 'text', {
              required: localize('com_auth_name_required'),
              minLength: {
                value: 3,
                message: localize('com_auth_name_min_length'),
              },
              maxLength: {
                value: 80,
                message: localize('com_auth_name_max_length'),
              },
            })}
            {renderInput('username', 'com_auth_username', 'text', {
              minLength: {
                value: 2,
                message: localize('com_auth_username_min_length'),
              },
              maxLength: {
                value: 80,
                message: localize('com_auth_username_max_length'),
              },
            })}
            {renderInput('email', 'com_auth_email', 'email', {
              required: localize('com_auth_email_required'),
              minLength: {
                value: 1,
                message: localize('com_auth_email_min_length'),
              },
              maxLength: {
                value: 120,
                message: localize('com_auth_email_max_length'),
              },
              pattern: {
                value: /\S+@\S+\.\S+/,
                message: localize('com_auth_email_pattern'),
              },
            })}
            {renderInput(
              'password',
              'com_auth_password',
              'password',
              {
                required: localize('com_auth_password_required'),
                minLength: {
                  value: startupConfig?.minPasswordLength || 8,
                  message: localize('com_auth_password_min_length'),
                },
                maxLength: {
                  value: 128,
                  message: localize('com_auth_password_max_length'),
                },
              },
              true,
              showPassword,
              () => setShowPassword(!showPassword),
            )}
            {renderInput(
              'confirm_password',
              'com_auth_password_confirm',
              'password',
              {
                validate: (value: string) =>
                  value === password || localize('com_auth_password_not_match'),
              },
              true,
              showConfirmPassword,
              () => setShowConfirmPassword(!showConfirmPassword),
            )}

            {/* AVI Roles Selectors */}
            <div className="mb-4">
              <div className="relative">
                <select
                  id="aviRol_id"
                  {...register('aviRol_id')}
                  className="webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none"
                >
                  <option value="">{localize('Seleccionar Rol AVI')}</option>
                  {aviRoles.map((role) => (
                    <option key={role._id} value={role._id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <label
                  htmlFor="aviRol_id"
                  className="absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-500"
                >
                  Rol AVI (Opcional)
                </label>
              </div>
            </div>

            {selectedAviRol && aviSubroles.length > 0 && (
              <div className="mb-4">
                <div className="relative">
                  <select
                    id="aviSubrol_id"
                    {...register('aviSubrol_id')}
                    className="webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none"
                  >
                    <option value="">{localize('Seleccionar Subrol AVI')}</option>
                    {aviSubroles.map((subrol) => (
                      <option key={subrol._id} value={subrol._id}>
                        {subrol.name}
                      </option>
                    ))}
                  </select>
                  <label
                    htmlFor="aviSubrol_id"
                    className="absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-500"
                  >
                    Subrol AVI (Opcional)
                  </label>
                </div>
              </div>
            )}

            {startupConfig?.turnstile?.siteKey && (
              <div className="my-4 flex justify-center">
                <Turnstile
                  siteKey={startupConfig.turnstile.siteKey}
                  options={{
                    ...startupConfig.turnstile.options,
                    theme: validTheme,
                  }}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                />
              </div>
            )}

            <div className="mt-6">
              <Button
                disabled={
                  Object.keys(errors).length > 0 ||
                  isSubmitting ||
                  (requireCaptcha && !turnstileToken)
                }
                type="submit"
                aria-label="Submit registration"
                variant="submit"
                className="h-12 w-full rounded-2xl"
              >
                {isSubmitting ? <Spinner /> : localize('com_auth_continue')}
              </Button>
            </div>
          </form>

          <p className="my-4 text-center text-sm font-light text-gray-700 dark:text-white">
            {localize('com_auth_already_have_account')}{' '}
            <a
              href="/login"
              aria-label="Login"
              className="inline-flex p-1 text-sm font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            >
              {localize('com_auth_login')}
            </a>
          </p>
        </>
      )}
    </>
  );
};

export default Registration;
