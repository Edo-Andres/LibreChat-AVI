import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys, Constants } from 'librechat-data-provider';
import { TooltipAnchor, Button, NewChatIcon } from '@librechat/client';
import type { TMessage } from 'librechat-data-provider';
import { useChatContext } from '~/Providers';
import { useLocalize } from '~/hooks';

export default function HeaderNewChat() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { conversation, newConversation } = useChatContext();

  const clickHandler: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
      window.open('/c/new', '_blank');
      return;
    }
    queryClient.setQueryData<TMessage[]>(
      [QueryKeys.messages, conversation?.conversationId ?? Constants.NEW_CONVO],
      [],
    );
    queryClient.invalidateQueries([QueryKeys.messages]);
    newConversation();
  };

  return (
    <TooltipAnchor
      description={localize('com_ui_new_chat')}
      render={
        <Button
          size="icon"
          variant="outline"
          data-testid="wide-header-new-chat-button"
          aria-label={localize('com_ui_new_chat')}
          className="rounded-full border-none bg-gradient-to-br from-chat-user-light to-chat-user-dark p-3 hover:opacity-90 transition-opacity max-md:hidden"
          onClick={clickHandler}
        >
          <NewChatIcon className="text-white" />
        </Button>
      }
    />
  );
}
