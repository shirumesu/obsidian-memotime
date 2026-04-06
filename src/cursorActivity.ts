type EditorLike = {
  listSelections(): Array<{
    anchor: { line: number; ch: number };
    head: { line: number; ch: number };
  }>;
  hasFocus(): boolean;
};

function buildSelectionSignature(editor: EditorLike): string {
  return JSON.stringify(editor.listSelections());
}

export class CursorActivityMonitor {
  private lastFilePath = '';
  private lastSelectionSignature = '';

  observe(filePath: string, editor: EditorLike): boolean {
    if (!filePath || !editor.hasFocus()) return false;

    const nextSignature = buildSelectionSignature(editor);
    if (this.lastFilePath !== filePath) {
      this.lastFilePath = filePath;
      this.lastSelectionSignature = nextSignature;
      return false;
    }

    if (this.lastSelectionSignature === nextSignature) {
      return false;
    }

    this.lastSelectionSignature = nextSignature;
    return true;
  }

  reset(): void {
    this.lastFilePath = '';
    this.lastSelectionSignature = '';
  }
}
