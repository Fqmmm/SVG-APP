export interface FileProbe {
  isFile(path: string): Promise<boolean>;
}
