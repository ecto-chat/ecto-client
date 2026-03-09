import { motion, AnimatePresence } from 'motion/react';

import { useUiStore, connectionManager } from 'ecto-core';

import { springGentle } from '@/lib/animations';

import { Modal } from '@/ui';

import { WizardProgress } from './WizardProgress';
import { WelcomeStep } from './WelcomeStep';
import { AdminStep } from './AdminStep';
import { ServerInfoStep } from './ServerInfoStep';
import { ServerSettingsStep } from './ServerSettingsStep';
import { TemplateStep } from './TemplateStep';
import { ChannelSetupStep } from './ChannelSetupStep';
import { CompletionStep } from './CompletionStep';
import { WizardNavigation } from './WizardNavigation';
import { useWizardActions } from './useWizardActions';

export function SetupWizard() {
  const open = useUiStore((s) => s.activeModal === 'setup-wizard');
  const serverId = useUiStore((s) => s.activeServerId);

  const closeModal = () => useUiStore.getState().closeModal();

  const {
    step, state, loading, error,
    updateState, goNext, goBack,
    handleIconUpload, handleSaveIdentity, handleSaveSettings,
    handleSelectTemplate, handleCreateChannels,
    handleCreateInvite, handleCopyInvite, handleFinish,
  } = useWizardActions(serverId, closeModal);

  if (!serverId) return null;

  const showBack = step > 1 && step !== 5 && !(step === 7 && state.invite);

  const serverUrl = connectionManager.getServerConnection(serverId)?.address ?? null;

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) closeModal(); }} title="Server Setup" width="full">
      <div className="flex flex-col gap-4">
        <WizardProgress currentStep={step} />

        {error && (
          <div className="rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={springGentle}
          >
            {step === 1 && <WelcomeStep />}
            {step === 2 && <AdminStep />}
            {step === 3 && (
              <ServerInfoStep
                state={state}
                updateState={updateState}
                onIconUpload={handleIconUpload}
              />
            )}
            {step === 4 && (
              <ServerSettingsStep state={state} updateState={updateState} />
            )}
            {step === 5 && (
              <TemplateStep onSelectTemplate={handleSelectTemplate} />
            )}
            {step === 6 && (
              <ChannelSetupStep state={state} updateState={updateState} />
            )}
            {step === 7 && (
              <CompletionStep
                state={state}
                loading={loading}
                requireInvite={state.requireInvite}
                serverUrl={serverUrl}
                onCreateInvite={handleCreateInvite}
                onCopyInvite={handleCopyInvite}
                onFinish={handleFinish}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <WizardNavigation
          step={step}
          loading={loading}
          showBack={showBack}
          channelsCreated={state.channelsCreated}
          onBack={goBack}
          onNext={goNext}
          onSaveIdentity={handleSaveIdentity}
          onSaveSettings={handleSaveSettings}
          onCreateChannels={handleCreateChannels}
        />
      </div>
    </Modal>
  );
}
