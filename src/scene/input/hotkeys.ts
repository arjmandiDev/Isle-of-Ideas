let __bound =false;

type Handlers = {
    onToggleEdit?: () => void;
    onAddPoint?: () => void;
    onClearAll?: () => void;
    onNextType?: () => void;
    onPrevType?: () => void;
}

function isTypingTarget(t: EventTarget | null) {
    if (!t || !(t as any).tagName) return false;
    const tag = (t as HTMLElement).tagName.toLowerCase();
    const editable = (t as HTMLElement).isContentEditable;
    return editable || tag == 'input' || tag == 'textarea' || tag == 'select';
}

export function bindTreeEditorHotkeys(h: Handlers): () => void {
    if (__bound) {
        // اگر قبلاً bind شده، یک cleanup خالی بده تا type همیشه () => void بماند
        return () => {};
    }
    __bound = true;

    const onKeyDown = (e: KeyboardEvent) => {
        if (isTypingTarget(e.target)) return;

        const k = (e.key || '').toLowerCase();
        const c = e.code || '';

        if (k === 'escape' || c === 'Escape') { e.preventDefault(); h.onToggleEdit?.(); return; }
        if (!e.repeat && (k === 'k' || c === 'KeyK')) { e.preventDefault(); h.onAddPoint?.(); return; }
        if (e.ctrlKey && (k === 'backspace' || c === 'Backspace')) { e.preventDefault(); h.onClearAll?.(); return; }
        if (!e.repeat && (k === ']' || c === 'BracketRight')) { e.preventDefault(); h.onNextType?.(); return; }
        if (!e.repeat && (k === '[' || c === 'BracketLeft'))  { e.preventDefault(); h.onPrevType?.(); return; }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });

    // ⬅️ cleanup برگردان
    return () => {
        window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
        __bound = false;
    };
}