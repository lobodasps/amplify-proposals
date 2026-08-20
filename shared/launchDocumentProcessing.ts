export interface RfpFileInputCapabilities {
  isPdf: boolean;
  isWord: boolean;
  supportsFileUrl: boolean;
}

/** Gemini accepts native PDF input, but DOCX must always be converted to text first. */
export function shouldUseNativeRfpFileInput(input: RfpFileInputCapabilities): boolean {
  return input.isPdf && input.supportsFileUrl;
}

/** DOCX is text-extracted locally; PDFs are also extracted when the provider lacks file input. */
export function shouldExtractRfpTextBeforeLlm(input: RfpFileInputCapabilities): boolean {
  return input.isWord || (input.isPdf && !input.supportsFileUrl);
}

/** A user-confirmed Main RFP is authoritative over an inconclusive automated skim. */
export function resolveLaunchClassificationLabel(
  isUserConfirmedMainRfp: boolean,
  classifierLabel: string | undefined,
  existingLabel: string,
): string {
  return isUserConfirmedMainRfp ? "Main RFP" : (classifierLabel ?? existingLabel);
}
