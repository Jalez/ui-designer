import type { Editor } from "@tiptap/react";

export function updateImageById(editor: Editor, id: string, patch: Record<string, any>) {
  const { state, view } = editor;
  let tr = state.tr;
  let foundPos: number | null = null;

  state.doc.descendants((node, pos) => {
    if (node.type.name === "image" && node.attrs.id === id) {
      foundPos = pos;
      return false; // stop walking descendants
    }
    return true;
  });

  if (foundPos == null) {
    console.warn("updateImageById: Image with ID not found:", id);
    return false;
  }

  const node = state.doc.nodeAt(foundPos)!;
  const newAttrs = { ...node.attrs, ...patch };

  tr = tr.setNodeMarkup(foundPos, node.type, newAttrs, node.marks);
  view.dispatch(tr);

  return true;
}

export function insertGeneratingImage(
  editor: Editor,
  { previewSrc, alt, pos, width, height, rounded = true }: { previewSrc: string | null; alt?: string; pos?: number; width?: number | string; height?: number | string; rounded?: boolean },
) {
  const id = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const imageData = {
    type: "image",
    attrs: {
      id,
      status: "pending",
      previewSrc,
      src: "",
      alt: alt ?? "Generating…",
      width: width ?? null,
      height: height ?? null,
      rounded: rounded ?? true,
    },
  };

  const insertPosition = pos ?? editor.state.selection.head;

  // Insert the image and then move cursor after it to avoid selecting the image
  editor
    .chain()
    .focus()
    .insertContentAt(insertPosition, imageData)
    .setTextSelection(insertPosition + 1) // Move cursor after the inserted image node
    .run();

  return id;
}
