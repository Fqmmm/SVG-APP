export class RegistrationConflict extends Error {
  constructor(category: string, name: string) {
    super("duplicate registration: " + category + "/" + name);
  }
}

export class ManifestMismatch extends Error {
  constructor(name: string, declared: string, registered: string) {
    super("plugin manifest mismatch: " + name + " (declared: " + declared + ", registered: " + registered + ")");
  }
}
