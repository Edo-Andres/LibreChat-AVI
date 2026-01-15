import React, { useCallback, useMemo, memo } from 'react';
import { useRecoilValue } from 'recoil';
import { type TMessage } from 'librechat-data-provider';
import type { TMessageProps, TMessageIcon } from '~/common';
import MessageContent from '~/components/Chat/Messages/Content/MessageContent';
import PlaceholderRow from '~/components/Chat/Messages/ui/PlaceholderRow';
import SiblingSwitch from '~/components/Chat/Messages/SiblingSwitch';
import HoverButtons from '~/components/Chat/Messages/HoverButtons';
import MessageIcon from '~/components/Chat/Messages/MessageIcon';
import { Plugin } from '~/components/Messages/Content';
import SubRow from '~/components/Chat/Messages/SubRow';
import FollowUpSuggestions from '~/components/Chat/Messages/FollowUpSuggestions';
import { MessageContext } from '~/Providers';
import { useMessageActions } from '~/hooks';
import { cn, logger } from '~/utils';
import store from '~/store';

type MessageRenderProps = {
  message?: TMessage;
  isCard?: boolean;
  isMultiMessage?: boolean;
  isSubmittingFamily?: boolean;
} & Pick<
  TMessageProps,
  'currentEditId' | 'setCurrentEditId' | 'siblingIdx' | 'setSiblingIdx' | 'siblingCount'
>;

const MessageRender = memo(
  ({
    message: msg,
    isCard = false,
    siblingIdx,
    siblingCount,
    setSiblingIdx,
    currentEditId,
    isMultiMessage = false,
    setCurrentEditId,
    isSubmittingFamily = false,
  }: MessageRenderProps) => {
    const {
      ask,
      edit,
      index,
      agent,
      assistant,
      enterEdit,
      conversation,
      messageLabel,
      isSubmitting,
      latestMessage,
      handleContinue,
      copyToClipboard,
      setLatestMessage,
      regenerateMessage,
      handleFeedback,
    } = useMessageActions({
      message: msg,
      currentEditId,
      isMultiMessage,
      setCurrentEditId,
    });
    const maximizeChatSpace = useRecoilValue(store.maximizeChatSpace);
    const fontSize = useRecoilValue(store.fontSize);

    const handleRegenerateMessage = useCallback(() => regenerateMessage(), [regenerateMessage]);
    const hasNoChildren = !(msg?.children?.length ?? 0);
    const isLast = useMemo(
      () => hasNoChildren && (msg?.depth === latestMessage?.depth || msg?.depth === -1),
      [hasNoChildren, msg?.depth, latestMessage?.depth],
    );
    const isLatestMessage = msg?.messageId === latestMessage?.messageId;
    const showCardRender = isLast && !isSubmittingFamily && isCard;
    const isLatestCard = isCard && !isSubmittingFamily && isLatestMessage;

    /** Only pass isSubmitting to the latest message to prevent unnecessary re-renders */
    const effectiveIsSubmitting = isLatestMessage ? isSubmitting : false;

    const iconData: TMessageIcon = useMemo(
      () => ({
        endpoint: msg?.endpoint ?? conversation?.endpoint,
        model: msg?.model ?? conversation?.model,
        iconURL: msg?.iconURL,
        modelLabel: messageLabel,
        isCreatedByUser: msg?.isCreatedByUser,
      }),
      [
        messageLabel,
        conversation?.endpoint,
        conversation?.model,
        msg?.model,
        msg?.iconURL,
        msg?.endpoint,
        msg?.isCreatedByUser,
      ],
    );

    const clickHandler = useMemo(
      () =>
        showCardRender && !isLatestMessage
          ? () => {
            logger.log(`Message Card click: Setting ${msg?.messageId} as latest message`);
            logger.dir(msg);
            setLatestMessage(msg!);
          }
          : undefined,
      [showCardRender, isLatestMessage, msg, setLatestMessage],
    );

    if (!msg) {
      return null;
    }

    const baseClasses = {
      common: 'group mx-auto flex flex-1 gap-3 transition-all duration-300 transform-gpu ',
      card: 'relative w-full gap-1 rounded-lg border border-border-medium bg-surface-primary-alt p-2 md:w-1/2 md:gap-3 md:p-4',
      chat: maximizeChatSpace
        ? 'w-full max-w-full md:px-5 lg:px-1 xl:px-5'
        : 'md:max-w-[47rem] xl:max-w-[55rem]',
    };

    const conditionalClasses = {
      latestCard: isLatestCard ? 'bg-surface-secondary' : '',
      cardRender: showCardRender ? 'cursor-pointer transition-colors duration-300' : '',
      focus: 'focus:outline-none focus:ring-2 focus:ring-border-xheavy',
    };

    return (
      <div
        id={msg.messageId}
        aria-label={`message-${msg.depth}-${msg.messageId}`}
        className={cn(
          baseClasses.common,
          isCard ? baseClasses.card : baseClasses.chat,
          conditionalClasses.latestCard,
          conditionalClasses.cardRender,
          conditionalClasses.focus,
          'message-render',
          msg.isCreatedByUser ? 'flex-row-reverse' : '',
        )}
        onClick={clickHandler}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && clickHandler) {
            clickHandler();
          }
        }}
        role={showCardRender ? 'button' : undefined}
        tabIndex={showCardRender ? 0 : undefined}
      >
        {isLatestCard && (
          <div className="absolute right-0 top-0 m-2 h-3 w-3 rounded-full bg-text-primary" />
        )}

        <div className={cn(
          "relative flex flex-shrink-0 flex-col items-center",
          msg.isCreatedByUser ? 'ml-3' : 'mr-3'
        )}>
          <div className={cn(
            "flex h-6 w-6 items-center justify-center overflow-hidden rounded-full",
            msg.isCreatedByUser ? 'bg-gradient-to-br from-chat-user-light to-chat-user-dark' : ''
          )}>
            <MessageIcon iconData={iconData} assistant={assistant} agent={agent} />
          </div>
        </div>

        <div
          className={cn(
            'relative flex flex-col',
            msg.isCreatedByUser ? 'max-w-[85%]' : 'w-11/12',
            msg.isCreatedByUser ? 'user-turn' : 'agent-turn',
          )}
        >
          <h2 className={cn('select-none font-semibold text-right mr-2', fontSize)}>{messageLabel}</h2>

          <div className="flex flex-col gap-1">
            <div className={cn(
              "flex max-w-full flex-grow flex-col gap-0",
              msg.isCreatedByUser ? 'rounded-tl-3xl rounded-bl-3xl rounded-br-3xl bg-gradient-to-br from-chat-user-light to-chat-user-dark p-6 shadow-lg' : ''
            )}>
              <MessageContext.Provider
                value={{
                  messageId: msg.messageId,
                  conversationId: conversation?.conversationId,
                  isExpanded: false,
                  isSubmitting: effectiveIsSubmitting,
                  isLatestMessage,
                }}
              >
                {msg.plugin && <Plugin plugin={msg.plugin} />}
                <div className={msg.isCreatedByUser ? 'text-white' : ''}>
                  <MessageContent
                    ask={ask}
                    edit={edit}
                    isLast={isLast}
                    text={msg.text || ''}
                    message={msg}
                    enterEdit={enterEdit}
                    error={!!(msg.error ?? false)}
                    isSubmitting={effectiveIsSubmitting}
                    unfinished={msg.unfinished ?? false}
                    isCreatedByUser={msg.isCreatedByUser ?? true}
                    siblingIdx={siblingIdx ?? 0}
                    setSiblingIdx={setSiblingIdx ?? (() => ({}))}
                  />
                </div>
              </MessageContext.Provider>
            </div>

            {hasNoChildren && (isSubmittingFamily === true || effectiveIsSubmitting) ? (
              <PlaceholderRow isCard={isCard} />
            ) : (
              <>
                <SubRow classes="text-xs">
                  <SiblingSwitch
                    siblingIdx={siblingIdx}
                    siblingCount={siblingCount}
                    setSiblingIdx={setSiblingIdx}
                  />
                  <HoverButtons
                    index={index}
                    isEditing={edit}
                    message={msg}
                    enterEdit={enterEdit}
                    isSubmitting={isSubmitting}
                    conversation={conversation ?? null}
                    regenerate={handleRegenerateMessage}
                    copyToClipboard={copyToClipboard}
                    handleContinue={handleContinue}
                    latestMessage={latestMessage}
                    handleFeedback={handleFeedback}
                    isLast={isLast}
                  />
                </SubRow>
                {/* Follow-up Suggestions - shown below assistant messages */}
                {(() => {
                  const shouldRenderFollowUp =
                    !msg.isCreatedByUser &&
                    isLast &&
                    !isSubmitting &&
                    !!conversation?.conversationId;

                  console.log('[MessageRender] FollowUpSuggestions conditions:', {
                    messageId: msg.messageId,
                    isCreatedByUser: msg.isCreatedByUser,
                    isLast,
                    isSubmitting,
                    hasConversationId: !!conversation?.conversationId,
                    conversationId: conversation?.conversationId,
                    shouldRenderFollowUp,
                  });

                  return shouldRenderFollowUp ? (
                    <FollowUpSuggestions
                      conversationId={conversation.conversationId!}
                      messageId={msg.messageId}
                      isLatestAssistantMessage={true}
                    />
                  ) : null;
                })()}
              </>
            )}
          </div>
        </div>
      </div>
    );
  },
);

// Add display name for debugging
MessageRender.displayName = 'MessageRender';

export default MessageRender;
