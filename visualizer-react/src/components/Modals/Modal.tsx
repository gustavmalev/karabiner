import React from 'react';
import { Modal as HeroModal, ModalContent, ModalBody, ModalHeader, ModalFooter } from '@heroui/react';

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <HeroModal isOpen={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }} backdrop="opaque">
      <ModalContent>
        {() => (
          <>
            <ModalHeader />
            <ModalBody>
              {children}
            </ModalBody>
            <ModalFooter />
          </>
        )}
      </ModalContent>
    </HeroModal>
  );
}
