import type { Model } from "../types";

/**
 * Shared model filtering utilities used by both store and server-side code
 */

export function filterTextModels(models: Model[]): Model[] {
  return models.filter((m) => {
    const modality = m.architecture?.modality;
    const hasPromptPricing = m.pricing?.prompt && parseFloat(m.pricing.prompt) > 0;

    if (typeof modality === 'string') {
      return modality === "text->text" || modality === "text+image->text" || modality.includes("text->text") || modality === "text";
    }
    if (Array.isArray(modality)) {
      return (modality as string[]).includes("text->text") || (modality as string[]).includes("text+image->text") || (modality as string[]).includes("text");
    }
    // If no modality info but has prompt pricing, consider it a text model
    return hasPromptPricing;
  });
}

export function filterImageModels(models: Model[]): Model[] {
  return models.filter((m) => {
    const modality = m.architecture?.modality;
    if (typeof modality === 'string') {
      return modality.includes("->image") || modality.includes("->text+image");
    }
    if (Array.isArray(modality)) {
      return (modality as string[]).some((mod: string) => mod.includes("->image") || mod.includes("->text+image"));
    }
    return false;
  });
}

export function filterOcrModels(models: Model[]): Model[] {
  return models.filter(model => {
    const modality = model.architecture?.modality as string | string[] | undefined;
    if (typeof modality === 'string') {
      return modality.includes('image->text') || modality.includes('document->text');
    }
    if (Array.isArray(modality)) {
      return (modality as string[]).some((mod: string) => mod.includes('image->text') || mod.includes('document->text'));
    }
    return false;
  });
}
