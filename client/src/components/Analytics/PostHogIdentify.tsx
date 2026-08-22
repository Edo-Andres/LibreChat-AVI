import { usePostHogIdentify } from '~/hooks';

/** Componente sin UI: sincroniza la identidad AVI del usuario con PostHog. */
const PostHogIdentify = () => {
  usePostHogIdentify();
  return null;
};

export default PostHogIdentify;
