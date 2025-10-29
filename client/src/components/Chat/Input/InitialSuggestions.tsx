import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGetStartupConfig } from '~/data-provider';
import { useSubmitMessage } from '~/hooks';
import { dataService } from 'librechat-data-provider';

interface InitialSuggestionsProps {
  show: boolean;
}

const InitialSuggestions = ({ show }: InitialSuggestionsProps) => {
  const { data: config } = useGetStartupConfig();
  const { submitMessage } = useSubmitMessage();

  // Handle suggestion click - submit and blur
  const handleSuggestionClick = useCallback((text: string) => {
    submitMessage({ text });
    // Blur the textarea to trigger hiding suggestions immediately
    const textarea = document.getElementById('text-input');
    if (textarea) {
      (textarea as HTMLTextAreaElement).blur();
    }
  }, [submitMessage]);

  // Fetch initial suggestions from API
  const { data: suggestionData } = useQuery(
    ['initialSuggestions'],
    () => dataService.getInitialSuggestions(),
    {
      enabled: show, // Only fetch when component should be visible
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      retry: 1,
    },
  );

  // Use API suggestions first, fallback to config defaults
  const suggestions =
    suggestionData?.suggestions ||
    config?.conversationSuggestions?.defaultInitialSuggestions ||
    [];

  // Always render container for smooth transitions, but hide when not needed
  const hasSuggestions = suggestions.length > 0;

  return (
    <div
      className={`px-4 transition-all duration-300 ease-in-out ${
        show && hasSuggestions
          ? 'max-h-48 opacity-100 pb-3 pt-2'
          : 'max-h-0 opacity-0 overflow-hidden pb-0 pt-0'
      }`}
    >
      <h3 className="mb-2 text-xs font-medium text-text-secondary">Sugerencias</h3>
      <div className="grid grid-cols-2 gap-2">
        {suggestions.slice(0, 4).map((text: string, index: number) => (
          <button
            key={index}
            onClick={() => handleSuggestionClick(text)}
            className="rounded-lg border border-border-medium bg-surface-secondary px-3 py-2.5 text-left text-sm text-text-secondary transition-all duration-200 hover:bg-surface-tertiary hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-1 animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className="line-clamp-2">{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default InitialSuggestions;
