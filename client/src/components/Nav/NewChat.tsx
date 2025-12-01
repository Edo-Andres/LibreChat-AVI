import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys, Constants } from 'librechat-data-provider';
import { TooltipAnchor, NewChatIcon, MobileSidebar, Sidebar, Button } from '@librechat/client';
import type { TMessage } from 'librechat-data-provider';
import { useLocalize, useNewConvo } from '~/hooks';
import store from '~/store';

export default function NewChat({
  index = 0,
  toggleNav,
  subHeaders,
  isSmallScreen,
  headerButtons,
}: {
  index?: number;
  toggleNav: () => void;
  isSmallScreen?: boolean;
  subHeaders?: React.ReactNode;
  headerButtons?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  /** Note: this component needs an explicit index passed if using more than one */
  const { newConversation: newConvo } = useNewConvo(index);
  const navigate = useNavigate();
  const localize = useLocalize();
  const { conversation } = store.useCreateConversationAtom(index);

  const clickHandler: React.MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
        window.open('/c/new', '_blank');
        return;
      }
      queryClient.setQueryData<TMessage[]>(
        [QueryKeys.messages, conversation?.conversationId ?? Constants.NEW_CONVO],
        [],
      );
      queryClient.invalidateQueries([QueryKeys.messages]);
      newConvo();
      navigate('/c/new', { state: { focusChat: true } });
      if (isSmallScreen) {
        toggleNav();
      }
    },
    [queryClient, conversation, newConvo, navigate, toggleNav, isSmallScreen],
  );

  return (
    <>
      <div className="flex flex-col gap-2 py-[2px] md:py-2">
        <div className="flex items-center justify-between">
          <TooltipAnchor
            description={localize('com_nav_close_sidebar')}
            render={
              <Button
                size="icon"
                variant="outline"
                data-testid="close-sidebar-button"
                aria-label={localize('com_nav_close_sidebar')}
                className="rounded-full border-none bg-transparent p-2 hover:bg-surface-hover md:rounded-xl"
                onClick={toggleNav}
              >
                <Sidebar className="max-md:hidden" />
                <MobileSidebar className="m-1 inline-flex size-10 items-center justify-center md:hidden" />
              </Button>
            }
          />
          <div className="flex gap-0.5">
            {headerButtons}
          </div>
        </div>

        <TooltipAnchor
          description={localize('com_ui_new_chat')}
          render={
            <Button
              variant="default"
              data-testid="nav-new-chat-button"
              aria-label={localize('com_ui_new_chat')}
              className="w-full rounded-lg border-none bg-gradient-to-r from-chat-user-light to-chat-user-dark px-4 py-2.5 text-white transition-opacity hover:opacity-90 shadow-lg"
              onClick={clickHandler}
            >
              <div className="flex items-center justify-center gap-2">
                <NewChatIcon className="icon-md text-white" />
                <span className="font-medium">{localize('com_ui_new_chat')}</span>
              </div>
            </Button>
          }
        />
      </div>
      {subHeaders != null ? subHeaders : null}
    </>
  );
}
