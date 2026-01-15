import { useMemo } from 'react';
import { OGDialog, DialogTemplate } from '@librechat/client';
import type { TTermsOfService } from 'librechat-data-provider';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { useLocalize } from '~/hooks';

const ViewTermsModal = ({
  open,
  onOpenChange,
  title,
  modalContent,
}: {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title?: string;
  modalContent?: TTermsOfService['modalContent'];
}) => {
  const localize = useLocalize();

  const handleClose = () => {
    onOpenChange(false);
  };

  const content = useMemo(() => {
    if (typeof modalContent === 'string') {
      return modalContent;
    }

    if (Array.isArray(modalContent)) {
      return modalContent.join('\n');
    }

    return '';
  }, [modalContent]);

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <DialogTemplate
        title={title ?? localize('com_ui_terms_of_service')}
        className="w-11/12 max-w-3xl sm:w-3/4 md:w-1/2 lg:w-2/5"
        showCloseButton={true}
        showCancelButton={false}
        main={
          <section
            tabIndex={0}
            className="max-h-[60vh] overflow-y-auto p-4"
            aria-label={localize('com_ui_terms_of_service')}
          >
            <div className="prose dark:prose-invert w-full max-w-none !text-text-primary">
              {content !== '' ? (
                <MarkdownLite content={content} />
              ) : (
                <p>{localize('com_ui_no_terms_content')}</p>
              )}
            </div>
          </section>
        }
        buttons={
          <button
            onClick={handleClose}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-green-500 px-6 py-2 text-sm font-medium text-white hover:bg-green-600 focus:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:bg-green-700"
          >
            {localize('com_ui_understood')}
          </button>
        }
      />
    </OGDialog>
  );
};

export default ViewTermsModal;
