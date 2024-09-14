import { readFileSync } from "fs";
import { simpleGit } from "simple-git";
import ts from "typescript";
import path, { dirname, normalize } from "path";
import cp from "child_process";

function getFileNames() {
    if (process.argv.length <= 2) {
        throw Error("No arg was provided!");
    }
    return process.argv.slice(2);
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
    const moduleName = JSON.parse(source.slice(pos, end));
    if (moduleName.startsWith(".")) {
        const filePath = path.join(sourceDir, moduleName + ".ts");
        const normalizedPath = normalize(filePath);
        if (notStagedFiles.includes(normalizedPath)) {
            filesToStage.push(normalizedPath);
            getImports(normalizedPath, notStagedFiles);
        }
    }
}

function getImports(fileName: string, notStagedFiles: string[]): void {
    if (isVisited[fileName] !== true) return;

    const sourceText = readFileSync(fileName).toString();
    const source = ts.createSourceFile(
        fileName,
        sourceText,
        ts.ScriptTarget.ES2015,
    );
    filesToStage.push(fileName);
    isVisited[fileName] = true;
    pushImports(source, sourceText, dirname(fileName), notStagedFiles);
}

async function main() {
    const fileNames = getFileNames();
    const git = simpleGit();
    const status = await git.status();
    console.log(filesToStage);
    for (const fileName of fileNames) {
        getImports(fileName, [...status.not_added, ...status.staged]);
    }

    const _ = cp.spawn("git", ["add", "-p", ...filesToStage], {
        stdio: "inherit",
    });
}

main().catch((err) => console.log(err));
