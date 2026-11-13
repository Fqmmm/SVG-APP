import { ShapeFactory } from "./ShapeFactory.js";
import { RegisteredSvgParser } from "../../infrastructure/svg/RegisteredSvgParser.js";
import { RegisteredSvgSerializer } from "../../infrastructure/svg/RegisteredSvgSerializer.js";
import { RegisteredFileDocumentRepository } from "../../infrastructure/RegisteredFileDocumentRepository.js";

export class FileDocumentRepository extends RegisteredFileDocumentRepository {
  constructor(parser?: RegisteredSvgParser, serializer?: RegisteredSvgSerializer) {
    const factory = new ShapeFactory();
    super(parser ?? new RegisteredSvgParser(factory), serializer ?? new RegisteredSvgSerializer(factory));
  }
}
