import {
  PropsWithChildren,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

interface AnchoredPanelProps {
  /** The element the panel opens under. */
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  label: string;
  className?: string;
}

/**
 * A panel drawn above the page (in a portal) under its anchor, kept inside
 * the window, and closed by Escape or a click outside the panel and anchor.
 */
export const AnchoredPanel = ({
  anchorRef,
  onClose,
  label,
  className,
  children,
}: PropsWithChildren<AnchoredPanelProps>) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>();

  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor) {
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const width = panel?.offsetWidth ?? 320;
      const height = panel?.offsetHeight ?? 0;
      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - width - 8),
      );
      let top = rect.bottom + 4;
      if (height && top + height > window.innerHeight - 8) {
        top = Math.max(8, rect.top - height - 4);
      }
      setPosition({ top, left });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchorRef]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !anchorRef.current?.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', onPointerDown, true);
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      className={className}
      style={{
        position: 'fixed',
        zIndex: 2000,
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        background: 'var(--c--contextuals--background--surface--primary, #fff)',
        border: '1px solid var(--c--contextuals--border--surface--primary)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {children}
    </div>,
    document.body,
  );
};
