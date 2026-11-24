import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ND13_CONSENT_SUMMARY,
  ND13_CONSENT_TITLE,
} from "@/features/auth/constants/auth.constants";

interface Nd13ConsentModalProps {
  onConfirm: () => void;
}

export function Nd13ConsentModal({ onConfirm }: Nd13ConsentModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  function handleConfirm(): void {
    onConfirm();
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Button
        type="button"
        variant="link"
        className="h-auto p-0 text-left"
        onClick={() => setIsOpen(true)}
      >
        Xem nội dung và xác nhận đồng ý
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ND13_CONSENT_TITLE}</DialogTitle>
          <DialogDescription>
            Tóm tắt thông tin để bạn xem trước khi đồng ý đăng ký.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-3 pl-5 text-sm text-muted-foreground">
          {ND13_CONSENT_SUMMARY.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" onClick={handleConfirm}>
            Đồng ý và tiếp tục
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
