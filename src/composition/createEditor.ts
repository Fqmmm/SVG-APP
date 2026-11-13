import { CheckpointRepository } from "./CheckpointRepository.js";
import { ShapeViews } from "../extensions/ShapeViews.js";
import { RegisteredShapeFactory } from "../application/shapes/RegisteredShapeFactory.js";
import { EditorSession } from "../application/session/EditorSession.js";
import { RegisteredCommandDispatcher } from "../cli/RegisteredCommandDispatcher.js";
import { RegisteredFileDocumentRepository } from "../infrastructure/RegisteredFileDocumentRepository.js";
import { RegisteredSvgParser } from "../infrastructure/svg/RegisteredSvgParser.js";
import { RegisteredSvgSerializer } from "../infrastructure/svg/RegisteredSvgSerializer.js";
import { createDefaultFramework } from "./createDefaultFramework.js";

export function createEditor(framework = createDefaultFramework(), report: (message: string) => void = console.error) {
  const factory = new RegisteredShapeFactory(framework.shapes);
  const repository = new RegisteredFileDocumentRepository(new RegisteredSvgParser(factory), new RegisteredSvgSerializer(factory));
  const session = new EditorSession(new CheckpointRepository(repository, new ShapeViews(factory), framework.decorators, report));
  return { framework, session, dispatcher: new RegisteredCommandDispatcher(session, framework) };
}
