import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'

export default function ConfirmDeleteModal({ open, onClose, onConfirm, title = 'Delete item', message, loading = false }) {
  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()} size="sm">
      <ModalContent>
        <ModalHeader className="text-base font-bold">{title}</ModalHeader>
        <ModalBody className="pb-1 text-sm text-default-500">{message}</ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={loading}>Cancel</Button>
          <Button color="danger" onPress={onConfirm} isLoading={loading}>Delete</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}