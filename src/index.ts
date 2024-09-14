import { readFileSync } from "fs";
import { simpleGit } from "simple-git";
import ts from "typescript";
import path, { dirname, normalize } from "path";
import { spawn } from "child_process";
import { bar } from "./foo/bar/bar";
import { foo } from "./foo/foo";

function getFileNames() {
    if (process.argv.length <= 2) {
        throw Error("No arg was provided!");
    }
    return process.argv.slice(2);
}

const filesToStage: string[] = [];

function pushImports(
    node: ts.Node,
    source: string,
    sourceDir: string,
    notStagedFiles: string[],
) {
    if (ts.isImportDeclaration(node)) {
        const { pos, end } = node.moduleSpecifier;
        const moduleName = JSON.parse(source.slice(pos, end));
        if (moduleName.startsWith(".")) {
            console.log(`moduleName: ${moduleName}`);
            const filePath = path.join(sourceDir, moduleName + ".ts");
            if (notStagedFiles.includes(filePath)) {
                const normalizedPath = normalize(filePath);
                // console.log(normalizedPath);
                filesToStage.push(normalizedPath);
                getImports([normalizedPath], notStagedFiles);
            }
        }
    }
    ts.forEachChild(node, (node: ts.Node) =>
        pushImports(node, source, sourceDir, notStagedFiles),
    );
}

function getImports(fileNames: string[], notStagedFiles: string[]): void {
    for (const fileName of fileNames) {
        const sourceText = readFileSync(fileName).toString();
        const source = ts.createSourceFile(
            fileName,
            sourceText,
            ts.ScriptTarget.ES2015,
        );
        filesToStage.push(fileName);
        pushImports(source, sourceText, dirname(fileName), notStagedFiles);
    }
}

async function main() {
    foo();
    bar();
    const files = getFileNames();
    const git = simpleGit();
    const status = await git.status();
    getImports(files, [...status.not_added, ...status.staged]);

    console.log(filesToStage);
    const r = spawn("git", ["add", "-p", ...filesToStage], {
        stdio: "inherit",
    });
}

main();
