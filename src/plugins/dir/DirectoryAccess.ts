export interface DirectoryEntry {
  readonly name: string;
  readonly kind: "directory" | "file" | "link" | "other";
}

export interface DirectoryAccess {
  currentDirectory(): string;
  entries(path: string): readonly DirectoryEntry[];
}
