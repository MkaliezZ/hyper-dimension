// A bounded state budget, shared by the server and the backup picker.
// Replay receipts remain intact; this hotfix does not prune transaction evidence.
export const MAX_SAVE_BYTES = 16 * 1024 * 1024;
export const MAX_IMPORT_BYTES = 64 * 1024 * 1024;
export const isSaveCapacityError = error => error?.code === 'save_too_large';
