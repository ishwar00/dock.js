import { readFileSync } from "fs";
import { simpleGit } from "simple-git";
import ts from "typescript";
import path, { dirname, normalize } from "path";
import cp from "child_process";

function getFilePaths() {
    if (process.argv.length <= 2) {
        throw Error("No arg was provided!");
    }
    return process.argv.slice(2);
}

function trimQuotes(str: string) {
    return str.replace(/['"\s]/g, "");
}

const isVisited: Record<string, boolean> = {};
const filesToStage: string[] = [];

function pushImports(
    node: ts.Node,
    source: string,
    sourceDir: string,
    notStagedFiles: string[],
) {
    if (!ts.isImportDeclaration(node)) {
        return void ts.forEachChild(node, (node: ts.Node) =>
            pushImports(node, source, sourceDir, notStagedFiles),
        );
    }
    const { pos, end } = node.moduleSpecifier;
    const moduleName = trimQuotes(source.slice(pos, end));
    if (moduleName.startsWith(".")) {
        const filePath = path.join(sourceDir, moduleName + ".ts");
        const normalizedPath = normalize(filePath);
        getImports(normalizedPath, notStagedFiles);
    }
}

function getImports(fileName: string, notStagedFiles: string[]): void {
    if (isVisited[fileName]) return;

    const sourceText = readFileSync(fileName).toString();
    const source = ts.createSourceFile(
        fileName,
        sourceText,
        ts.ScriptTarget.ES2015,
    );
    if (notStagedFiles.includes(fileName)) {
        filesToStage.push(fileName);
    }
    isVisited[fileName] = true;
    pushImports(source, sourceText, dirname(fileName), notStagedFiles);
}

async function main() {
    const fileNames = getFilePaths();
    const git = simpleGit();
    const status = await git.status();
    for (const fileName of fileNames) {
        getImports(fileName, [...status.not_added, ...status.modified]);
    }
    console.log("Dependencies: ", filesToStage);
    cp.spawn("git", ["add", "-p", ...filesToStage], {
        stdio: "inherit",
    });
}

main().catch((err) => console.log(err));
