export function formatStaffFullName(input: {
  paternalLastName: string;
  maternalLastName?: string | null;
  firstNames: string;
}): string {
  return [input.paternalLastName, input.maternalLastName, input.firstNames]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}
