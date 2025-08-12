import React from 'react';
import { HeroModal, ModalContent, ModalBody, ModalHeader, ModalFooter } from '../ui';
import { overlayMotion } from '../../ui/motion';

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
  hideCloseButton?: boolean;
};

export function Modal({ open, onClose, children, size = 'md', isDismissable = true, isKeyboardDismissDisabled = false, hideCloseButton = false }: Props) {
  return (
    <HeroModal
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      backdrop="opaque"
      size={size}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      hideCloseButton={hideCloseButton}
      motionProps={overlayMotion}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader />
            <ModalBody>{children}</ModalBody>
            <ModalFooter />
          </>
        )}
      </ModalContent>
    </HeroModal>
  );
}
