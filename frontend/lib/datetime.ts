/**
 * Converts a zone-less "YYYY-MM-DDTHH:mm" value from a date/time input into
 * an absolute ISO timestamp. Without the offset the backend reads it as UTC.
 */
export function toApiDateTime(local: string) {
    const date = new Date(local);
    return Number.isNaN(date.getTime()) ? local : date.toISOString();
}
