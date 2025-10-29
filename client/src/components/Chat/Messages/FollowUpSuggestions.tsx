import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataService } from 'librechat-data-provider';
import { useSubmitMessage } from '~/hooks';

interface FollowUpSuggestionsProps {
  conversationId: string;
  messageId: string;
  isLatestAssistantMessage: boolean;
}

const FollowUpSuggestions = ({
  conversationId,
  messageId,
  isLatestAssistantMessage,
}: FollowUpSuggestionsProps) => {
  const [shouldFetch, setShouldFetch] = useState(false);
  const { submitMessage } = useSubmitMessage();

  console.log('[FollowUpSuggestions] Component rendered:', {
    conversationId,
    messageId,
    isLatestAssistantMessage,
    shouldFetch,
  });

  // Trigger fetch after message is rendered (with small delay)
  useEffect(() => {
    console.log('[FollowUpSuggestions] useEffect triggered:', { isLatestAssistantMessage });
    if (isLatestAssistantMessage) {
      const timer = setTimeout(() => {
        console.log('[FollowUpSuggestions] Setting shouldFetch to true');
        setShouldFetch(true);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isLatestAssistantMessage]);

  // Fetch follow-up suggestions
  const { data: suggestionData, isLoading, error } = useQuery(
    ['followUpSuggestions', messageId],
    () => {
      console.log('[FollowUpSuggestions] Fetching suggestions for:', conversationId);
      return dataService.getFollowUpSuggestions({ conversationId });
    },
    {
      enabled: shouldFetch && isLatestAssistantMessage,
      staleTime: Infinity, // Don't refetch - suggestions are contextual to this message
      retry: 1,
      onSuccess: (data) => {
        console.log('[FollowUpSuggestions] Query success:', data);
      },
      onError: (err) => {
        console.error('[FollowUpSuggestions] Query error:', err);
      },
    },
  );

  const suggestions = suggestionData?.suggestions || [];

  console.log('[FollowUpSuggestions] State:', {
    isLoading,
    error,
    suggestionsCount: suggestions.length,
    suggestions,
  });

  // Don't render if not latest message, still loading initial render, or no suggestions
  if (!isLatestAssistantMessage || !suggestions.length) {
    console.log('[FollowUpSuggestions] Returning null:', {
      isLatestAssistantMessage,
      suggestionsLength: suggestions.length,
    });
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {suggestions.map((text: string, index: number) => (
        <button
          key={index}
          onClick={() => submitMessage({ text })}
          className="rounded-lg border border-border-medium bg-surface-secondary px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-tertiary focus:outline-none focus:ring-2 focus:ring-offset-1"
          disabled={isLoading}
        >
          {text}
        </button>
      ))}
    </div>
  );
};

export default FollowUpSuggestions;
