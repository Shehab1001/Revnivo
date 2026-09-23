import { Modal as HeroModal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'

export default function Modal({ open, onClose, title, children }) {
  return (
    <HeroModal isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="text-lg font-bold">{title}</ModalHeader>
        <ModalBody className="pb-6">{children}</ModalBody>
      </ModalContent>
    </HeroModal>
  )
}
