// Utility functions for working with images and captions in Tiptap

import type { EditorInstance } from "novel";

export const insertImageWithCaption = (editor: EditorInstance, imageUrl: string, caption?: string) => {
  if (caption) {
    // Insert a figure with image and caption
    editor.commands.insertContent(`
      <figure class="my-4">
        <img src="${imageUrl}" alt="${caption}" class="rounded-lg border border-muted max-w-full h-auto" />
        <figcaption class="mt-2 text-center text-sm text-muted-foreground">${caption}</figcaption>
      </figure>
    `);
  } else {
    // Insert just the image
    editor.commands.setImage({ src: imageUrl });
  }
};

export const addCaptionToImage = (editor: EditorInstance, caption: string) => {
  const { state } = editor;
  const { selection } = state;

  // Check if we're at an image
  const node = state.doc.nodeAt(selection.from);
  if (node && node.type.name === "image") {
    // Wrap the image in a figure with caption
    const imagePos = selection.from;
    const imageNode = state.doc.nodeAt(imagePos);

    if (imageNode) {
      const figureHTML = `
        <figure class="my-4">
          <img src="${imageNode.attrs.src}" alt="${imageNode.attrs.alt || ""}" class="rounded-lg border border-muted max-w-full h-auto" />
          <figcaption class="mt-2 text-center text-sm text-muted-foreground">${caption}</figcaption>
        </figure>
      `;

      // Replace the image with the figure
      editor.commands.insertContentAt(imagePos, figureHTML);
      editor.commands.deleteRange({ from: imagePos, to: imagePos + imageNode.nodeSize });
    }
  }
};

export const removeCaptionFromImage = (editor: EditorInstance) => {
  const { state } = editor;
  const { selection } = state;

  // Check if we're at a figure containing an image
  const node = state.doc.nodeAt(selection.from);
  if (node && node.type.name === "paragraph") {
    // Look for figure elements in the paragraph
    const figureMatch = node.textContent.match(/<figure[^>]*>.*?<\/figure>/s);
    if (figureMatch) {
      // Extract just the image from the figure
      const imgMatch = figureMatch[0].match(/<img[^>]*>/);
      if (imgMatch) {
        editor.commands.insertContent(imgMatch[0]);
      }
    }
  }
};
