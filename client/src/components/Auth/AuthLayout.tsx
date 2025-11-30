import { ThemeSelector } from '@librechat/client';
import { TStartupConfig } from 'librechat-data-provider';
import { TranslationKeys, useLocalize } from '~/hooks';
import { BlinkAnimation } from './BlinkAnimation';
import { Banner } from '../Banners';
import AuthSlider from './AuthSlider';

const ErrorRender = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-4 flex justify-center">
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-md border border-red-500 bg-red-500/10 px-3 py-2 text-sm text-gray-600 dark:text-gray-200"
    >
      {children}
    </div>
  </div>
);

function AuthLayout({
  children,
  header,
  isFetching,
  startupConfig,
  startupConfigError,
  pathname,
  error,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  isFetching: boolean;
  startupConfig: TStartupConfig | null | undefined;
  startupConfigError: unknown | null | undefined;
  pathname: string;
  error: TranslationKeys | null;
}) {
  const localize = useLocalize();

  const hasStartupConfigError = startupConfigError !== null && startupConfigError !== undefined;
  const DisplayError = () => {
    if (hasStartupConfigError) {
      return <ErrorRender>{localize('com_auth_error_login_server')}</ErrorRender>;
    } else if (error === 'com_auth_error_invalid_reset_token') {
      return (
        <ErrorRender>
          {localize('com_auth_error_invalid_reset_token')}{' '}
          <a className="font-semibold text-green-600 hover:underline" href="/forgot-password">
            {localize('com_auth_click_here')}
          </a>{' '}
          {localize('com_auth_to_try_again')}
        </ErrorRender>
      );
    } else if (error != null && error) {
      return <ErrorRender>{localize(error)}</ErrorRender>;
    }
    return null;
  };

  const isRegister = pathname === '/register';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-gray-900">
      <AuthSlider />

      <div className="relative flex w-full items-center justify-center overflow-y-auto bg-gray-50 p-8 dark:bg-gray-800 lg:w-7/12">
        <div className="absolute left-0 top-0 w-full">
          <Banner />
        </div>
        <div className="absolute right-4 top-4">
          <ThemeSelector />
        </div>

        {isRegister ? (
          // Register page: wider container, no card wrapper (Registration component handles its own layout)
          <div className="w-full max-w-5xl">
            <DisplayError />
            {children}
          </div>
        ) : (
          // Login/other pages: card container with logo and header
          <div className="w-full max-w-md space-y-8 rounded-[2rem] bg-white p-12 shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:bg-gray-900">
            
            <div className="text-center">
              {!hasStartupConfigError && !isFetching && (
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {header}
                </h2>
              )}
              <p className="mt-2 text-gray-500">Ingresa tus credenciales para continuar</p>
            </div>

            <DisplayError />
            
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthLayout;
