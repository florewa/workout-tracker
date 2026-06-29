<script setup lang="ts">
const { toasts, confirmState, settleConfirm } = useDialog()

const toastIcon: Record<string, string> = {
  success: 'lucide:check-circle-2',
  error: 'lucide:alert-circle',
  info: 'lucide:info',
}
</script>

<template>
  <Teleport to="body">
    <!-- Тосты -->
    <div class="toasts">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast glass" :class="t.kind">
          <Icon :name="toastIcon[t.kind]" class="toast-icon" />
          <span class="toast-text">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>

    <!-- Подтверждение -->
    <Transition name="modal">
      <div v-if="confirmState.open" class="backdrop" @click.self="settleConfirm(false)">
        <div class="dialog glass">
          <h2 v-if="confirmState.title" class="dialog-title">{{ confirmState.title }}</h2>
          <p class="dialog-message">{{ confirmState.message }}</p>
          <div class="dialog-actions">
            <button type="button" class="btn cancel" @click="settleConfirm(false)">
              {{ confirmState.cancelText }}
            </button>
            <button type="button" class="btn confirm" :class="{ danger: confirmState.danger }" @click="settleConfirm(true)">
              {{ confirmState.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.toasts {
  position: fixed;
  left: 50%;
  bottom: calc(86px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 120;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  width: max-content;
  max-width: calc(100vw - var(--space-5));
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: 14px;
  color: var(--text);

  .toast-icon { font-size: 18px; flex-shrink: 0; }
  .toast-text { line-height: 1.3; }

  &.success .toast-icon { color: #34c759; }
  &.error .toast-icon { color: var(--accent); }
  &.info .toast-icon { color: var(--accent); }
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 130;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgba(0, 0, 0, 0.55);
}

.dialog {
  width: 100%;
  max-width: 360px;
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.dialog-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 19px;
  color: var(--text);
}

.dialog-message {
  margin: 0;
  font-size: 15px;
  line-height: 1.4;
  color: var(--muted);
}

.dialog-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.btn {
  flex: 1;
  min-height: 46px;
  border: 0;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;

  &.cancel { background: var(--surface-2); color: var(--text); }
  &.confirm { background: var(--accent); color: var(--accent-text); }
  &.confirm.danger { background: #ff3b30; color: #fff; }

  &:active { transform: scale(0.98); }
}

/* Анимации */
.toast-enter-active,
.toast-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.toast-enter-from,
.toast-leave-to { opacity: 0; transform: translateY(8px); }

.modal-enter-active,
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-active .dialog,
.modal-leave-active .dialog { transition: transform 0.2s ease; }
.modal-enter-from .dialog,
.modal-leave-to .dialog { transform: scale(0.95); }
</style>
