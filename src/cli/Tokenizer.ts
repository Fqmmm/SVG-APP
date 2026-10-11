export class Tokenizer {
  tokenize(line: string): readonly string[] {
    if (line.trim() === "" || line.trimStart().startsWith("#")) return [];
    const tokens: string[] = [];
    let index = 0;
    while (index < line.length) {
      if (/\s/u.test(line[index]!)) { index += 1; continue; }
      if (line[index] === '"') {
        const [token, next] = this.readQuoted(line, index + 1);
        tokens.push(token);
        index = next;
        if (index < line.length && !/\s/u.test(line[index]!)) {
          throw new Error("quoted argument must be followed by whitespace");
        }
      } else {
        const start = index;
        while (index < line.length && !/\s/u.test(line[index]!)) {
          if (line[index] === '"') throw new Error("quote must start an argument");
          index += 1;
        }
        tokens.push(line.slice(start, index));
      }
    }
    return Object.freeze(tokens);
  }

  private readQuoted(line: string, start: number): readonly [string, number] {
    let token = "";
    for (let index = start; index < line.length; index += 1) {
      const character = line[index]!;
      if (character === '"') return [token, index + 1];
      if (character === "\\") {
        const escaped = line[index + 1];
        if (escaped !== '"' && escaped !== "\\") {
          throw new Error("invalid escape in quoted argument");
        }
        token += escaped;
        index += 1;
      } else {
        token += character;
      }
    }
    throw new Error("unterminated quoted argument");
  }
}
