import { RegisteredShapeFactory } from "../application/RegisteredShapeFactory.js";
import { EditorSession } from "../application/EditorSession.js";
import { RegisteredCommandDispatcher } from "../cli/RegisteredCommandDispatcher.js";
import { RegisteredFileDocumentRepository } from "../infrastructure/RegisteredFileDocumentRepository.js";
import { RegisteredSvgParser } from "../infrastructure/RegisteredSvgParser.js";
import { RegisteredSvgSerializer } from "../infrastructure/RegisteredSvgSerializer.js";
import { createDefaultFramework } from "./createDefaultFramework.js";

export function createEditor(framework = createDefaultFramework()) {
  const factory = new RegisteredShapeFactory(framework.shapes);
  const repository = new RegisteredFileDocumentRepository(new RegisteredSvgParser(factory), new RegisteredSvgSerializer(factory));
  const session = new EditorSession(repository);
  return { framework, session, dispatcher: new RegisteredCommandDispatcher(session, framework) };
}
