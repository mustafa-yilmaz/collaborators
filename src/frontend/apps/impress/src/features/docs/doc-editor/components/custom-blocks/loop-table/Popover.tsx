import {
  PropsWithChildren,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
  onClose: () => void;
  align?: 'left' | 'right';
  label: string;
}

/**
 * A small panel under the element it is rendered in, closed by Escape or a
 * click outside. It is drawn above the page (in a portal), so the table's
 * horizontal scrolling never cuts it.
 */
export const Popover = ({
  onClose,
  align = 'left',
  label,
  children,
}: PropsWithChildren<PopoverProps>) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>();

  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current?.parentElement;
      const panel = panelRef.current;
      if (!anchor) {
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const width = panel?.offsetWidth ?? 260;
      const height = panel?.offsetHeight ?? 0;
      let left = align === 'right' ? rect.right - width : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      let top = rect.bottom + 4;
      if (height && top + height > window.innerHeight - 8) {
        // Not enough room below: open above
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
  }, [align]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onClose]);

  return (
    <>
      <span ref={anchorRef} aria-hidden="true" style={{ display: 'none' }} />
      {createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={label}
          className="loop-table__popover"
          style={{
            position: 'fixed',
            top: position?.top ?? -9999,
            left: position?.left ?? -9999,
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') {
              onClose();
            }
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
};
