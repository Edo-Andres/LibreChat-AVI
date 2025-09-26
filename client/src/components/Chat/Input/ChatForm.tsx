import { memo, useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useWatch } from 'react-hook-form';
import { TextareaAutosize } from '@librechat/client';
import { useRecoilState, useRecoilValue } from 'recoil';
import { Constants, isAssistantsEndpoint, isAgentsEndpoint } from 'librechat-data-provider';
import {
  useChatContext,
  useChatFormContext,
  useAddedChatContext,
  useAssistantsMapContext,
} from '~/Providers';
import {
  useTextarea,
  useAutoSave,
  useRequiresKey,
  useHandleKeyUp,
  useQueryParams,
  useSubmitMessage,
  useFocusChatEffect,
} from '~/hooks';
import { useGetStartupConfig } from '~/data-provider';
import { mainTextareaId, BadgeItem } from '~/common';
import AttachFileChat from './Files/AttachFileChat';
import FileFormChat from './Files/FileFormChat';
import { cn, removeFocusRings } from '~/utils';
import TextareaHeader from './TextareaHeader';
import PromptsCommand from './PromptsCommand';
import AudioRecorder from './AudioRecorder';
import CollapseChat from './CollapseChat';
import StreamAudio from './StreamAudio';
import StopButton from './StopButton';
import SendButton from './SendButton';
import EditBadges from './EditBadges';
import BadgeRow from './BadgeRow';
import Mention from './Mention';
import PhoneButton from './PhoneButton';
import store from '~/store';

const ChatForm = memo(({ index = 0 }: { index?: number }) => {
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  useFocusChatEffect(textAreaRef);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [, setIsScrollable] = useState(false);
  const [visualRowCount, setVisualRowCount] = useState(1);
  const [isTextAreaFocused, setIsTextAreaFocused] = useState(false);
  const [backupBadges, setBackupBadges] = useState<Pick<BadgeItem, 'id'>[]>([]);
  
  // Estados para ElevenLabs ConvAI
  const [showElevenLabsWidget, setShowElevenLabsWidget] = useState(false);
  
  // Ref para trackear el observer actual y evitar duplicados
  const elevenLabsObserverRef = useRef<MutationObserver | null>(null);

  const SpeechToText = useRecoilValue(store.speechToText);
  const TextToSpeech = useRecoilValue(store.textToSpeech);
  const chatDirection = useRecoilValue(store.chatDirection);
  const automaticPlayback = useRecoilValue(store.automaticPlayback);
  const maximizeChatSpace = useRecoilValue(store.maximizeChatSpace);
  const centerFormOnLanding = useRecoilValue(store.centerFormOnLanding);
  const isTemporary = useRecoilValue(store.isTemporary);

  const [badges, setBadges] = useRecoilState(store.chatBadges);
  const [isEditingBadges, setIsEditingBadges] = useRecoilState(store.isEditingBadges);
  const [showStopButton, setShowStopButton] = useRecoilState(store.showStopButtonByIndex(index));
  const [showPlusPopover, setShowPlusPopover] = useRecoilState(store.showPlusPopoverFamily(index));
  const [showMentionPopover, setShowMentionPopover] = useRecoilState(
    store.showMentionPopoverFamily(index),
  );

  const { requiresKey } = useRequiresKey();
  const methods = useChatFormContext();
  const {
    files,
    setFiles,
    conversation,
    isSubmitting,
    filesLoading,
    newConversation,
    handleStopGenerating,
  } = useChatContext();
  const {
    addedIndex,
    generateConversation,
    conversation: addedConvo,
    setConversation: setAddedConvo,
    isSubmitting: isSubmittingAdded,
  } = useAddedChatContext();
  const assistantMap = useAssistantsMapContext();
  const showStopAdded = useRecoilValue(store.showStopButtonByIndex(addedIndex));

  const endpoint = useMemo(
    () => conversation?.endpointType ?? conversation?.endpoint,
    [conversation?.endpointType, conversation?.endpoint],
  );
  
  // Obtener configuración de startup para ElevenLabs
  const { data: config } = useGetStartupConfig();
  
  const conversationId = useMemo(
    () => conversation?.conversationId ?? Constants.NEW_CONVO,
    [conversation?.conversationId],
  );

  const isRTL = useMemo(
    () => (chatDirection != null ? chatDirection?.toLowerCase() === 'rtl' : false),
    [chatDirection],
  );
  const invalidAssistant = useMemo(
    () =>
      isAssistantsEndpoint(endpoint) &&
      (!(conversation?.assistant_id ?? '') ||
        !assistantMap?.[endpoint ?? '']?.[conversation?.assistant_id ?? '']),
    [conversation?.assistant_id, endpoint, assistantMap],
  );
  const disableInputs = useMemo(
    () => requiresKey || invalidAssistant,
    [requiresKey, invalidAssistant],
  );

  const handleContainerClick = useCallback(() => {
    /** Check if the device is a touchscreen */
    if (window.matchMedia?.('(pointer: coarse)').matches) {
      return;
    }
    textAreaRef.current?.focus();
  }, []);

  const handleFocusOrClick = useCallback(() => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
  }, [isCollapsed]);

  useAutoSave({
    files,
    setFiles,
    textAreaRef,
    conversationId,
    isSubmitting: isSubmitting || isSubmittingAdded,
  });

  const { submitMessage, submitPrompt } = useSubmitMessage();

  const handleKeyUp = useHandleKeyUp({
    index,
    textAreaRef,
    setShowPlusPopover,
    setShowMentionPopover,
  });
  const {
    isNotAppendable,
    handlePaste,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
  } = useTextarea({
    textAreaRef,
    submitButtonRef,
    setIsScrollable,
    disabled: disableInputs,
  });

  useQueryParams({ textAreaRef });

  const { ref, ...registerProps } = methods.register('text', {
    required: true,
    onChange: useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) =>
        methods.setValue('text', e.target.value, { shouldValidate: true }),
      [methods],
    ),
  });

  const textValue = useWatch({ control: methods.control, name: 'text' });

  useEffect(() => {
    if (textAreaRef.current) {
      const style = window.getComputedStyle(textAreaRef.current);
      const lineHeight = parseFloat(style.lineHeight);
      setVisualRowCount(Math.floor(textAreaRef.current.scrollHeight / lineHeight));
    }
  }, [textValue]);

  useEffect(() => {
    if (isEditingBadges && backupBadges.length === 0) {
      setBackupBadges([...badges]);
    }
  }, [isEditingBadges, badges, backupBadges.length]);

  const handleSaveBadges = useCallback(() => {
    setIsEditingBadges(false);
    setBackupBadges([]);
  }, [setIsEditingBadges, setBackupBadges]);

  const handleCancelBadges = useCallback(() => {
    if (backupBadges.length > 0) {
      setBadges([...backupBadges]);
    }
    setIsEditingBadges(false);
    setBackupBadges([]);
  }, [backupBadges, setBadges, setIsEditingBadges]);

  const handlePhoneClick = useCallback(() => {
    console.log('Botón de teléfono clickeado');
    
    // Si el widget está oculto, mostrarlo y configurar la funcionalidad
    if (!showElevenLabsWidget) {
      setShowElevenLabsWidget(true);
      
      // Usar setTimeout para asegurar que el widget esté renderizado
      setTimeout(() => {
        setupElevenLabsWidget();
      }, 100);
    }
    // Si ya está visible, no hacer nada (según requerimientos)
  }, [showElevenLabsWidget]);

  // Función auxiliar para configurar el widget de ElevenLabs
  const setupElevenLabsWidget = useCallback(() => {
    try {
      const elevenLabsWidget = document.querySelector('elevenlabs-convai');
      if (!elevenLabsWidget?.shadowRoot) {
        console.log('Widget de ElevenLabs no encontrado o shadowRoot no disponible');
        return;
      }

      console.log('Configurando widget de ElevenLabs...');

      // Limpiar observer anterior si existe
      if (elevenLabsObserverRef.current) {
        elevenLabsObserverRef.current.disconnect();
        elevenLabsObserverRef.current = null;
        console.log('Observer anterior desconectado');
      }

      // Flag para evitar reconfiguración múltiple
      let endConfigured = false;

      // Función para activar automáticamente el botón "Llamar a AVI"
      const activateCallButton = () => {
        try {
          // Buscar el botón "Llamar a AVI" específicamente
          const aviButton = elevenLabsWidget.shadowRoot?.querySelector('button[aria-label="Llamar a AVI"]') as HTMLButtonElement;
          if (aviButton) {
            aviButton.click();
            console.log('Botón "Llamar a AVI" activado automáticamente');
            return;
          }

          // Fallback: buscar cualquier botón de llamada
          const callButton = elevenLabsWidget.shadowRoot?.querySelector('button[aria-label*="Llamar"], button[aria-label*="Call"]') as HTMLButtonElement;
          if (callButton) {
            callButton.click();
            console.log('Botón de llamada activado automáticamente (fallback)');
            return;
          }

          // Último fallback: hacer clic en el primer botón disponible
          const anyButton = elevenLabsWidget.shadowRoot?.querySelector('button') as HTMLButtonElement;
          if (anyButton) {
            anyButton.click();
            console.log('Primer botón disponible activado automáticamente');
          }
        } catch (error) {
          console.error('Error al activar botón de llamada:', error);
        }
      };

      // Función para ocultar visualmente el botón "Collapse" y su contenedor
      const hideCollapseButton = () => {
        try {
          let hiddenCount = 0;
          
          // 1. Ocultar el botón "Collapse" directamente
          const collapseButton = elevenLabsWidget.shadowRoot?.querySelector('button[aria-label="Collapse"]') as HTMLButtonElement;
          if (collapseButton) {
            // Múltiples métodos para asegurar ocultación completa del botón
            collapseButton.style.display = 'none';
            collapseButton.style.visibility = 'hidden';
            collapseButton.style.opacity = '0';
            collapseButton.style.position = 'absolute';
            collapseButton.style.left = '-9999px';
            collapseButton.style.width = '0';
            collapseButton.style.height = '0';
            collapseButton.style.overflow = 'hidden';
            collapseButton.style.pointerEvents = 'none';
            collapseButton.setAttribute('hidden', 'true');
            collapseButton.setAttribute('aria-hidden', 'true');
            hiddenCount++;
          }
          
          // 2. Ocultar el div contenedor específico
          const collapseContainer = elevenLabsWidget.shadowRoot?.querySelector('div:nth-child(2) > div.transition-\\[border-radius\\].flex.flex-col.p-2.rounded-compact-sheet.bg-base.shadow-md.pointer-events-auto.overflow-hidden.cursor-pointer') as HTMLElement;
          if (collapseContainer) {
            // Ocultar completamente el contenedor
            collapseContainer.style.display = 'none';
            collapseContainer.style.visibility = 'hidden';
            collapseContainer.style.opacity = '0';
            collapseContainer.style.position = 'absolute';
            collapseContainer.style.left = '-9999px';
            collapseContainer.style.width = '0';
            collapseContainer.style.height = '0';
            collapseContainer.style.overflow = 'hidden';
            collapseContainer.style.pointerEvents = 'none';
            collapseContainer.setAttribute('hidden', 'true');  
            collapseContainer.setAttribute('aria-hidden', 'true');
            hiddenCount++;
          }
          
          // 3. Búsqueda alternativa por clases CSS (fallback)
          const alternativeContainers = elevenLabsWidget.shadowRoot?.querySelectorAll('div.transition-\\[border-radius\\]') as NodeListOf<HTMLElement>;
          if (alternativeContainers && alternativeContainers.length > 0) {
            alternativeContainers.forEach((container, index) => {
              // Verificar si este contenedor tiene el botón collapse
              const hasCollapseButton = container.querySelector('button[aria-label="Collapse"]');
              if (hasCollapseButton) {
                container.style.display = 'none';
                container.style.visibility = 'hidden';
                container.style.opacity = '0';
                container.setAttribute('hidden', 'true');
                container.setAttribute('aria-hidden', 'true');
                hiddenCount++;
              }
            });
          }
          
          if (hiddenCount > 0) {
            console.log(`Botón "Collapse" y contenedor(es) ocultados completamente - ${hiddenCount} elementos`);
            return true;
          }
        } catch (error) {
          console.error('Error al ocultar botón Collapse y contenedor:', error);
        }
        return false;
      };

      // Función para ocultar repetidamente el botón Collapse (más agresiva)
      const aggressiveHideCollapse = (attempts = 0, maxAttempts = 20) => {
        if (attempts >= maxAttempts) {
          console.log('Máximo de intentos alcanzado para ocultar botón Collapse');
          return;
        }

        const success = hideCollapseButton();
        if (!success) {
          // Si no lo encontró, reintentar después de un tiempo
          setTimeout(() => {
            aggressiveHideCollapse(attempts + 1, maxAttempts);
          }, 100); // Cada 100ms
        } else {
          // Aún si lo ocultó, verificar de nuevo por si aparece otra vez
          setTimeout(() => {
            aggressiveHideCollapse(attempts + 1, maxAttempts);
          }, 200);
        }
      };

      // Función común para ocultar widget
      const hideWidget = () => {
        // Limpiar observer antes de ocultar
        if (elevenLabsObserverRef.current) {
          elevenLabsObserverRef.current.disconnect();
          elevenLabsObserverRef.current = null;
        }
        
        setTimeout(() => {
          setShowElevenLabsWidget(false);
          console.log('Widget ocultado');
        }, 100);
      };

      // Función para bloquear temporalmente el botón "New call"
      const blockNewCallTemporarily = () => {
        try {
          const shadowRoot = elevenLabsWidget.shadowRoot;
          if (!shadowRoot) return;

          // Buscar todos los spans que contengan "New call"
          const spans = shadowRoot.querySelectorAll('span');
          spans.forEach(span => {
            if (span.textContent?.includes('New call')) {
              const button = span.closest('button') as HTMLButtonElement;
              if (button) {
                // Deshabilitar el botón temporalmente
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
                button.style.pointerEvents = 'none';
                console.log('Botón "New call" bloqueado temporalmente por 1,2 segundos');
                
                // Restaurar después de 3 segundos
                setTimeout(() => {
                  button.disabled = false;
                  button.style.opacity = '';
                  button.style.cursor = '';
                  button.style.pointerEvents = '';
                  console.log('Botón "New call" desbloqueado');
                }, 1200);
              }
            }
          });

          // También buscar el span específico con las clases mencionadas
          const specificSpan = shadowRoot.querySelector('span.block.whitespace-nowrap.max-w-64.truncate.px-1\\.5');
          if (specificSpan && specificSpan.textContent?.includes('New call')) {
            const button = specificSpan.closest('button') as HTMLButtonElement;
            if (button) {
              button.disabled = true;
              button.style.opacity = '0.5';
              button.style.cursor = 'not-allowed';
              button.style.pointerEvents = 'none';
              
              setTimeout(() => {
                button.disabled = false;
                button.style.opacity = '';
                button.style.cursor = '';
                button.style.pointerEvents = '';
              }, 1200);
            }
          }
        } catch (error) {
          console.error('Error al bloquear botón New call:', error);
        }
      };

      // Función para configurar el botón "End"
      const setupEndButton = (endButton: HTMLButtonElement) => {
        try {
          console.log('Configurando botón "End"...');
          
          // Bloquear temporalmente el botón "New call" cuando se haga click en "End"
          endButton.addEventListener('click', () => {
            console.log('Botón "End" clickeado');
            
            // Bloquear "New call" por 1.2 segundos
            setTimeout(() => {
              blockNewCallTemporarily();
            }, 500);
            
            // Mantener la funcionalidad original de cerrar el widget
            setTimeout(() => {
              hideWidget();
              console.log('Widget ocultado por botón End');
            }, 200);
            
          }, { once: true });
          
          endConfigured = true;
          console.log('Botón "End" configurado con bloqueo temporal de New call');
          return true;
        } catch (error) {
          console.error('Error al configurar botón End:', error);
          return false;
        }
      };

      // Activar el botón de llamada inmediatamente
      activateCallButton();

      // Usar la función agresiva para ocultar el botón "Collapse"
      setTimeout(() => {
        aggressiveHideCollapse();
      }, 300); // Comenzar después de 300ms

      // Buscar el botón "End" inmediatamente
      const immediateEndButton = elevenLabsWidget.shadowRoot?.querySelector('button[aria-label="End"]') as HTMLButtonElement;
      if (immediateEndButton) {
        setupEndButton(immediateEndButton);
        console.log('Configuración inicial completada (End encontrado inmediatamente)');
        return; // Salir temprano si ya encontramos el botón End
      }

      console.log('Configuración inicial del widget (sin botón Collapse)...');

      // MutationObserver para configurar botón "End"
      const observer = new MutationObserver((mutations) => {
        // Verificar si ya configuramos el botón End
        if (endConfigured) {
          observer.disconnect();
          elevenLabsObserverRef.current = null;
          console.log('Observer desconectado - configuración End completa');
          return;
        }

        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            
            // Intentar ocultar el botón Collapse de forma agresiva si aparece
            aggressiveHideCollapse();
            
            // Solo buscar y configurar botón "End"
            if (!endConfigured) {
              const endButton = elevenLabsWidget.shadowRoot?.querySelector('button[aria-label="End"]') as HTMLButtonElement;
              if (endButton) {
                setupEndButton(endButton);
                
                // Desconectar observer una vez que configuramos el botón End
                console.log('Configuración End completada via observer, desconectando');
                observer.disconnect();
                elevenLabsObserverRef.current = null;
                return;
              }
            }
          }
        }
      });

      // Guardar referencia del observer
      elevenLabsObserverRef.current = observer;

      // Iniciar observación del shadowRoot solo para nuevos nodos
      observer.observe(elevenLabsWidget.shadowRoot, { 
        childList: true, 
        subtree: true,
        attributes: false // No observar cambios de atributos
      });

      // Limpiar el observer después de 10 segundos para evitar memory leaks
      setTimeout(() => {
        if (elevenLabsObserverRef.current === observer) {
          observer.disconnect();
          elevenLabsObserverRef.current = null;
          console.log('Observer limpiado por timeout');
        }
      }, 10000);

    } catch (error) {
      console.error('Error al configurar el widget de ElevenLabs:', error);
    }
  }, [setShowElevenLabsWidget]);

  // Cleanup effect para limpiar observer cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (elevenLabsObserverRef.current) {
        elevenLabsObserverRef.current.disconnect();
        elevenLabsObserverRef.current = null;
      }
    };
  }, []);

  const isMoreThanThreeRows = visualRowCount > 3;

  const baseClasses = useMemo(
    () =>
      cn(
        'md:py-3.5 m-0 w-full resize-none py-[13px] placeholder-black/50 bg-transparent dark:placeholder-white/50 [&:has(textarea:focus)]:shadow-[0_2px_6px_rgba(0,0,0,.05)]',
        isCollapsed ? 'max-h-[52px]' : 'max-h-[45vh] md:max-h-[55vh]',
        isMoreThanThreeRows ? 'pl-5' : 'px-5',
      ),
    [isCollapsed, isMoreThanThreeRows],
  );

  return (
    <>
      <form
        onSubmit={methods.handleSubmit(submitMessage)}
        className={cn(
          'mx-auto flex w-full flex-row gap-3 transition-[max-width] duration-300 sm:px-2',
          maximizeChatSpace ? 'max-w-full' : 'md:max-w-3xl xl:max-w-4xl',
          centerFormOnLanding &&
            (conversationId == null || conversationId === Constants.NEW_CONVO) &&
            !isSubmitting &&
            conversation?.messages?.length === 0
            ? 'transition-all duration-200 sm:mb-28'
            : 'sm:mb-10',
        )}
      >
      <div className="relative flex h-full flex-1 items-stretch md:flex-col">
        <div className={cn('flex w-full items-center', isRTL && 'flex-row-reverse')}>
          {showPlusPopover && !isAssistantsEndpoint(endpoint) && (
            <Mention
              setShowMentionPopover={setShowPlusPopover}
              newConversation={generateConversation}
              textAreaRef={textAreaRef}
              commandChar="+"
              placeholder="com_ui_add_model_preset"
              includeAssistants={false}
            />
          )}
          {showMentionPopover && (
            <Mention
              setShowMentionPopover={setShowMentionPopover}
              newConversation={newConversation}
              textAreaRef={textAreaRef}
            />
          )}
          <PromptsCommand index={index} textAreaRef={textAreaRef} submitPrompt={submitPrompt} />
          <div
            onClick={handleContainerClick}
            className={cn(
              'relative flex w-full flex-grow flex-col overflow-hidden rounded-t-3xl border pb-4 text-text-primary transition-all duration-200 sm:rounded-3xl sm:pb-0',
              isTextAreaFocused ? 'shadow-lg' : 'shadow-md',
              isTemporary
                ? 'border-violet-800/60 bg-violet-950/10'
                : 'border-border-light bg-surface-chat',
            )}
          >
            <TextareaHeader addedConvo={addedConvo} setAddedConvo={setAddedConvo} />
            <EditBadges
              isEditingChatBadges={isEditingBadges}
              handleCancelBadges={handleCancelBadges}
              handleSaveBadges={handleSaveBadges}
              setBadges={setBadges}
            />
            <FileFormChat conversation={conversation} />
            {endpoint && (
              <div className={cn('flex', isRTL ? 'flex-row-reverse' : 'flex-row')}>
                <TextareaAutosize
                  {...registerProps}
                  ref={(e) => {
                    ref(e);
                    (textAreaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = e;
                  }}
                  disabled={disableInputs || isNotAppendable}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                  id={mainTextareaId}
                  tabIndex={0}
                  data-testid="text-input"
                  rows={1}
                  onFocus={() => {
                    handleFocusOrClick();
                    setIsTextAreaFocused(true);
                  }}
                  onBlur={setIsTextAreaFocused.bind(null, false)}
                  onClick={handleFocusOrClick}
                  style={{ height: 44, overflowY: 'auto' }}
                  className={cn(
                    baseClasses,
                    removeFocusRings,
                    'transition-[max-height] duration-200 disabled:cursor-not-allowed',
                  )}
                />
                <div className="flex flex-col items-start justify-start pt-1.5">
                  <CollapseChat
                    isCollapsed={isCollapsed}
                    isScrollable={isMoreThanThreeRows}
                    setIsCollapsed={setIsCollapsed}
                  />
                </div>
              </div>
            )}
            <div
              className={cn(
                'items-between flex gap-2 pb-2',
                isRTL ? 'flex-row-reverse' : 'flex-row',
              )}
            >
              <div className={`${isRTL ? 'mr-2' : 'ml-2'}`}>
                <AttachFileChat conversation={conversation} disableInputs={disableInputs} />
              </div>
              <BadgeRow
                showEphemeralBadges={!isAgentsEndpoint(endpoint) && !isAssistantsEndpoint(endpoint)}
                isSubmitting={isSubmitting || isSubmittingAdded}
                conversationId={conversationId}
                onChange={setBadges}
                isInChat={
                  Array.isArray(conversation?.messages) && conversation.messages.length >= 1
                }
              />
              <div className="mx-auto flex" />
              {SpeechToText && (
                <AudioRecorder
                  methods={methods}
                  ask={submitMessage}
                  textAreaRef={textAreaRef}
                  disabled={disableInputs || isNotAppendable}
                  isSubmitting={isSubmitting}
                />
              )}
              <div className={`${isRTL ? 'ml-2' : 'mr-2'}`}>
                {(isSubmitting || isSubmittingAdded) && (showStopButton || showStopAdded) ? (
                  <StopButton stop={handleStopGenerating} setShowStopButton={setShowStopButton} />
                ) : (
                  endpoint && (
                    <SendButton
                      ref={submitButtonRef}
                      control={methods.control}
                      disabled={filesLoading || isSubmitting || disableInputs || isNotAppendable}
                    />
                  )
                )}
              </div>
              <div className={`${isRTL ? 'ml-2' : 'mr-2'}`}>
                <PhoneButton
                  disabled={disableInputs}
                  onClick={handlePhoneClick}
                />
              </div>
            </div>
            {TextToSpeech && automaticPlayback && <StreamAudio index={index} />}
          </div>
        </div>
      </div>
    </form>
    {/* Widget de ElevenLabs ConvAI */}
    <div 
      style={{ display: showElevenLabsWidget ? 'block' : 'none' }}
      dangerouslySetInnerHTML={{
        __html: `<elevenlabs-convai agent-id="${(config as any)?.elevenLabsAgentId || ''}"></elevenlabs-convai>`
      }}
    />
    </>
  );
});

export default ChatForm;
