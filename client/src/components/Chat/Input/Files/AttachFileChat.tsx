import { memo } from 'react';
import type { TConversation } from 'librechat-data-provider';

function AttachFileChat({
  disableInputs,
  conversation,
}: {
  disableInputs: boolean;
  conversation: TConversation | null;
}) {
  // Botón de adjuntar archivos desactivado
  return null;
}

export default memo(AttachFileChat);
