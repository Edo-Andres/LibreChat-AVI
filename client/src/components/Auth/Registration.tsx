import { useForm } from 'react-hook-form';
import React, { useContext, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { Eye, EyeOff, Check } from 'lucide-react';
import { ThemeContext, Spinner, Button, isDark } from '@librechat/client';
import { useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import {
  useRegisterUserMutation,
  useAviRolesQuery,
  useAviSubrolesQuery,
} from 'librechat-data-provider/react-query';
import type { TRegisterUser, TError } from 'librechat-data-provider';
import type { TLoginLayoutContext } from '~/common';
import { useLocalize } from '~/hooks';
import { ErrorMessage } from './ErrorMessage';

// Extended type to include phone field
type TRegisterUserWithPhone = TRegisterUser & { phone?: string };

const Registration: React.FC = () => {
  const navigate = useNavigate();
  const localize = useLocalize();
  const { theme } = useContext(ThemeContext);
  const { startupConfig, startupConfigError, isFetching } =
    useOutletContext<TLoginLayoutContext>();

  const {
    watch,
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<TRegisterUserWithPhone>({ mode: 'onChange' });

  const password = watch('password');
  const selectedAviRol = watch('aviRol_id');

  // AVI Roles queries
  const { data: aviRoles = [] } = useAviRolesQuery();
  const { data: aviSubroles = [] } = useAviSubrolesQuery(selectedAviRol || '');

  // Component state
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number>(3);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);

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

  // Step navigation with validation
  const handleNextStep = async () => {
    let fieldsToValidate: (keyof TRegisterUserWithPhone)[] = [];

    if (currentStep === 1) {
      fieldsToValidate = ['name', 'username', 'phone'];
    } else if (currentStep === 2) {
      fieldsToValidate = ['email', 'aviRol_id'];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Form submission
  const onSubmit = (data: TRegisterUserWithPhone) => {
    const normalizedData = {
      ...data,
      email: data.email.toLowerCase(),
      token: token ?? undefined,
    };
    registerUser.mutate(normalizedData);
  };

  // Step indicator renderer
  const renderStepIndicator = (step: number, title: string, description: string) => {
    const isActive = step === currentStep;
    const isCompleted = step < currentStep;

    return (
      <div className="flex items-center space-x-4">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
            isActive
              ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
              : isCompleted
                ? 'border border-green-200 bg-green-100 text-green-600 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'border-2 border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-800'
          }`}
        >
          {isCompleted ? <Check className="h-4 w-4" /> : step}
        </div>
        <div>
          <p
            className={`text-sm font-medium transition-colors ${
              isActive
                ? 'font-bold text-gray-900 dark:text-white'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {title}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600">{description}</p>
        </div>
      </div>
    );
  };

  // Floating label input classes
  const inputBaseClass =
    'webkit-dark-styles peer w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary transition-colors duration-200 focus:border-green-500 focus:outline-none';
  const labelBaseClass =
    'absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-500';

  return (
    <div className="mx-auto flex h-[600px] w-full max-w-4xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
      {/* Sidebar / Progress */}
      <div className="hidden w-[30%] flex-col justify-between border-r border-gray-100 bg-gray-50 p-8 dark:border-gray-800 dark:bg-gray-800/50 md:flex">
        <div>
          <div className="mb-10 flex items-center space-x-2">
            <span className="text-sm font-bold uppercase tracking-wide text-green-600">
              Registro
            </span>
          </div>

          <div className="relative space-y-8">
            {/* Vertical Line */}
            <div className="absolute bottom-2 left-[15px] top-2 -z-10 w-0.5 bg-gray-200 dark:bg-gray-700" />

            {renderStepIndicator(1, 'Identidad', 'Datos básicos')}
            {renderStepIndicator(2, 'Académico', 'Rol y área')}
            {renderStepIndicator(3, 'Acceso', 'Credenciales')}
          </div>
        </div>

        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Paso <span className="font-bold text-green-600">{currentStep}</span> de 3
        </div>
      </div>

      {/* Form Area */}
      <div className="relative flex w-full flex-col justify-between bg-white p-8 dark:bg-gray-900 md:w-[70%] md:p-12">
        {/* Error Messages */}
        {errorMessage && (
          <ErrorMessage>
            {localize('com_auth_error_create')} {errorMessage}
          </ErrorMessage>
        )}

        {/* Success Message */}
        {registerUser.isSuccess && countdown > 0 && (
          <div
            className="mb-4 rounded-md border border-green-500 bg-green-500/10 px-3 py-2 text-sm text-gray-600 dark:text-gray-200"
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
          <form
            className="flex h-full flex-col justify-between"
            aria-label="Registration form"
            method="POST"
            onSubmit={handleSubmit(onSubmit)}
          >
            {/* Step 1: Identity */}
            {currentStep === 1 && (
              <div className="flex-1">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    ¿Quién eres?
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Ingresa tus datos personales para comenzar.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Name */}
                  <div className="relative">
                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      placeholder=" "
                      {...register('name', {
                        required: localize('com_auth_name_required'),
                        minLength: { value: 3, message: localize('com_auth_name_min_length') },
                        maxLength: { value: 80, message: localize('com_auth_name_max_length') },
                      })}
                      className={inputBaseClass}
                    />
                    <label htmlFor="name" className={labelBaseClass}>
                      {localize('com_auth_full_name')}
                    </label>
                    {errors.name && (
                      <span className="mt-1 text-sm text-red-500">
                        {String(errors.name.message)}
                      </span>
                    )}
                  </div>

                  {/* Username */}
                  <div className="relative">
                    <input
                      id="username"
                      type="text"
                      autoComplete="username"
                      placeholder=" "
                      {...register('username', {
                        minLength: { value: 2, message: localize('com_auth_username_min_length') },
                        maxLength: { value: 80, message: localize('com_auth_username_max_length') },
                      })}
                      className={inputBaseClass}
                    />
                    <label htmlFor="username" className={labelBaseClass}>
                      {localize('com_auth_username')}{' '}
                      <span className="text-xs text-gray-400">(opcional)</span>
                    </label>
                    {errors.username && (
                      <span className="mt-1 text-sm text-red-500">
                        {String(errors.username.message)}
                      </span>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="relative">
                    <input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder=" "
                      {...register('phone')}
                      className={inputBaseClass}
                    />
                    <label htmlFor="phone" className={labelBaseClass}>
                      Teléfono <span className="text-xs text-gray-400">(opcional)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Academic */}
            {currentStep === 2 && (
              <div className="flex-1">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Perfil Académico
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Define tu rol dentro de la institución.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Email */}
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder=" "
                      {...register('email', {
                        required: localize('com_auth_email_required'),
                        minLength: { value: 1, message: localize('com_auth_email_min_length') },
                        maxLength: { value: 120, message: localize('com_auth_email_max_length') },
                        pattern: { value: /\S+@\S+\.\S+/, message: localize('com_auth_email_pattern') },
                      })}
                      className={inputBaseClass}
                    />
                    <label htmlFor="email" className={labelBaseClass}>
                      {localize('com_auth_email')}
                    </label>
                    {errors.email && (
                      <span className="mt-1 text-sm text-red-500">
                        {String(errors.email.message)}
                      </span>
                    )}
                  </div>

                  {/* AVI Role */}
                  <div className="relative">
                    <select
                      id="aviRol_id"
                      {...register('aviRol_id')}
                      className={`${inputBaseClass} cursor-pointer appearance-none`}
                    >
                      <option value="">Selecciona tu rol...</option>
                      {aviRoles.map((role) => (
                        <option key={role._id} value={role._id}>
                          {role.registerAnswer || role.name}
                        </option>
                      ))}
                    </select>
                    <label htmlFor="aviRol_id" className={labelBaseClass}>
                      Rol AVI
                    </label>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* AVI Subrole (conditional) */}
                  {selectedAviRol && aviSubroles.length > 0 && (
                    <div className="relative">
                      <select
                        id="aviSubrol_id"
                        {...register('aviSubrol_id')}
                        className={`${inputBaseClass} cursor-pointer appearance-none`}
                      >
                        <option value="">Selecciona una opción...</option>
                        {aviSubroles.map((subrol) => (
                          <option key={subrol._id} value={subrol._id}>
                            {subrol.registerAnswer || subrol.name}
                          </option>
                        ))}
                      </select>
                      <label htmlFor="aviSubrol_id" className={labelBaseClass}>
                        Subrol AVI <span className="text-xs text-gray-400">(opcional)</span>
                      </label>
                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Security */}
            {currentStep === 3 && (
              <div className="flex-1">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Seguridad</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Protege tu cuenta con una contraseña segura.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Password */}
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder=" "
                      {...register('password', {
                        required: localize('com_auth_password_required'),
                        minLength: {
                          value: startupConfig?.minPasswordLength || 8,
                          message: localize('com_auth_password_min_length'),
                        },
                        maxLength: { value: 128, message: localize('com_auth_password_max_length') },
                      })}
                      className={`${inputBaseClass} pr-10 [&::-ms-reveal]:hidden`}
                    />
                    <label htmlFor="password" className={labelBaseClass}>
                      {localize('com_auth_password')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-text-primary"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                    {errors.password && (
                      <span className="mt-1 text-sm text-red-500">
                        {String(errors.password.message)}
                      </span>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="relative">
                    <input
                      id="confirm_password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder=" "
                      {...register('confirm_password', {
                        validate: (value) =>
                          value === password || localize('com_auth_password_not_match'),
                      })}
                      className={`${inputBaseClass} pr-10 [&::-ms-reveal]:hidden`}
                    />
                    <label htmlFor="confirm_password" className={labelBaseClass}>
                      {localize('com_auth_password_confirm')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-text-primary"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                    {errors.confirm_password && (
                      <span className="mt-1 text-sm text-red-500">
                        {String(errors.confirm_password.message)}
                      </span>
                    )}
                  </div>

                  {/* Turnstile Captcha */}
                  {startupConfig?.turnstile?.siteKey && (
                    <div className="flex justify-center">
                      <Turnstile
                        siteKey={startupConfig.turnstile.siteKey}
                        options={{ ...startupConfig.turnstile.options, theme: validTheme }}
                        onSuccess={(token) => setTurnstileToken(token)}
                        onError={() => setTurnstileToken(null)}
                        onExpire={() => setTurnstileToken(null)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-6 dark:border-gray-800">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-800"
                >
                  Atrás
                </button>
              ) : (
                <div />
              )}

              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="ml-auto transform rounded-xl bg-green-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-green-500/30 transition-all hover:scale-105 hover:bg-green-700"
                >
                  Continuar
                </button>
              ) : (
                <Button
                  type="submit"
                  disabled={
                    Object.keys(errors).length > 0 ||
                    isSubmitting ||
                    (requireCaptcha && !turnstileToken)
                  }
                  className="ml-auto transform rounded-xl bg-gray-900 px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  {isSubmitting ? <Spinner /> : 'Crear Cuenta'}
                </Button>
              )}
            </div>

            {/* Login Link */}
            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {localize('com_auth_already_have_account')}{' '}
              <a
                href="/login"
                className="font-bold text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              >
                {localize('com_auth_login')}
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default Registration;
