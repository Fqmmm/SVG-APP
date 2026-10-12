import { readFileSync, openSync, writeFileSync, closeSync, renameSync, unlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { DocumentRepository } from "../application/DocumentRepository.js";
import type { DocumentReadResult } from "../application/DocumentReadResult.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import { SvgParser } from "./SvgParser.js";
import { SvgSerializer } from "./SvgSerializer.js";

export class FileDocumentRepository implements DocumentRepository {
  constructor(
    private readonly parser = new SvgParser(),
    private readonly serializer = new SvgSerializer(),
  ) {}

  read(path: string): DocumentReadResult {
    let xml: string;
    try {
      xml = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(path));
    } catch {
      throw new Error("cannot read file: " + path);
    }
    return this.parser.parse(xml);
  }

  write(path: string, document: SvgDocument): void {
    const xml = this.serializer.serialize(document);
    const target = resolve(path);
    const temporary = join(dirname(target), "." + basename(target) + "." + randomUUID() + ".tmp");
    let created = false;
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporary, "wx");
      created = true;
      try {
        writeFileSync(descriptor, xml, { encoding: "utf8" });
      } finally {
        const opened = descriptor;
        descriptor = undefined;
        closeSync(opened);
      }
      renameSync(temporary, target);
      created = false;
    } catch {
      throw new Error("cannot write file: " + path);
    } finally {
      if (created) {
        try { unlinkSync(temporary); } catch {
          // Keep the prescribed write error if temporary-file cleanup also fails.
        }
      }
    }
  }
}
